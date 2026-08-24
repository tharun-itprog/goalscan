/**
 * Tier 2's camera: photograph a nutrition panel instead of a barcode.
 *
 * Reached from two dead ends — ScannerScreen's "no barcode in hand" fallback
 * (barcode unknown, passed as `''`) and NotFoundScreen's "photograph the
 * label" (barcode known but unscorable via Open Food Facts) — so `barcode`
 * is just a string this screen tags the eventual scan with; it never assumes
 * a non-empty one.
 *
 * Own state machine, four steps:
 *   framing       camera preview + capture button
 *   working       the /extract call is in flight (a couple of seconds — a
 *                 vision model, not a barcode lookup, so it needs its own
 *                 "this isn't frozen" feedback)
 *   needsServing  extraction succeeded but the panel never printed a serving
 *                 size — the already-paid-for extraction is retried locally
 *                 via completeWithServingSize, never re-photographed
 *   failed        unreadable (retake) or error (retry, or bail to the
 *                 scanner) — see the branches below for why they differ
 *
 * Only a successful extraction ever calls `onScanned` — every other outcome
 * is handled in place, the same way ScannerScreen never calls onScanned for
 * "still scanning".
 *
 * This is a camera screen, so like ScannerScreen it draws exclusively from
 * `colors.dark.*` for every step, not just framing — a light needsServing
 * form sandwiched between two dark screens would read as a glitch.
 */

import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import SecondaryButton from '../components/SecondaryButton';
import {
  completeWithServingSize,
  scanLabel,
  type ExtractionResponse,
  type LabelScanResult,
} from '../api/labelScan';
import { evaluateProduct } from '../scan/evaluate';
import { colors, radii, spacing, type } from '../theme';
import type { Profile } from '../types';
import type { ScanOutcome } from './ScannerScreen';

interface Props {
  barcode: string;
  profile: Profile;
  onScanned: (outcome: ScanOutcome) => void;
  onCancel: () => void;
}

type CaptureState =
  | { step: 'framing' }
  | { step: 'working' }
  | { step: 'needsServing'; productName: string | null; raw: ExtractionResponse }
  | { step: 'failed'; reason: 'unreadable' }
  | { step: 'failed'; reason: 'error'; message: string };

export default function LabelCaptureScreen({ barcode, profile, onScanned, onCancel }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<CaptureState>({ step: 'framing' });
  const [servingInput, setServingInput] = useState('');
  const [servingError, setServingError] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  // Belt-and-braces against a double tap on the shutter landing two
  // in-flight captures — the state transition to 'working' is async, so a
  // fast second tap can slip in before the first render commits.
  const capturingRef = useRef(false);

  const applyResult = useCallback(
    (result: LabelScanResult) => {
      switch (result.status) {
        case 'extracted':
          onScanned({ kind: 'success', ...evaluateProduct(result.product, profile) });
          return;
        case 'unreadable':
          setState({ step: 'failed', reason: 'unreadable' });
          return;
        case 'needs_serving_size':
          setServingInput('');
          setServingError(null);
          setState({ step: 'needsServing', productName: result.productName, raw: result.raw });
          return;
        case 'error':
          setState({ step: 'failed', reason: 'error', message: result.message });
          return;
      }
    },
    [profile, onScanned],
  );

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || capturingRef.current) return;
    capturingRef.current = true;
    setState({ step: 'working' });

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 1, base64: false });

      // Resize before upload rather than asking the camera for base64
      // directly: a full-resolution phone photo is several megabytes, and
      // the vision API downsamples anything that large anyway, so sending it
      // costs upload time and image tokens for pixels that get thrown away.
      // 1600px wide is comfortably enough to read a nutrition panel.
      const ctx = ImageManipulator.manipulate(photo.uri);
      ctx.resize({ width: 1600 });
      const image = await ctx.renderAsync();
      const out = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });

      if (!out.base64) {
        setState({ step: 'failed', reason: 'error', message: 'Could not process that photo. Try again.' });
        return;
      }

      applyResult(await scanLabel(out.base64, barcode));
    } catch {
      setState({ step: 'failed', reason: 'error', message: 'Something went wrong capturing that photo.' });
    } finally {
      capturingRef.current = false;
    }
  }, [barcode, applyResult]);

  const handleSubmitServing = useCallback(() => {
    if (state.step !== 'needsServing') return;

    const value = Number(servingInput.trim());
    if (!Number.isFinite(value) || value <= 0) {
      setServingError('Enter a serving size greater than zero.');
      return;
    }
    setServingError(null);

    const result = completeWithServingSize(state.raw, value, barcode);
    // completeWithServingSize only fixes a `per_serving` panel missing its
    // size. If the extraction's basis was `unknown` in the first place, it
    // refuses again no matter what's typed here (see labelScan.ts) — no
    // serving size reveals which column was read. Treat a repeated
    // needs_serving_size as that dead end rather than looping this same form
    // back at the user forever.
    if (result.status === 'needs_serving_size') {
      setState({
        step: 'failed',
        reason: 'error',
        message:
          "This label's values couldn't be matched to per-100g or per-serving, so a serving size can't complete it. Try photographing the panel again.",
      });
      return;
    }
    applyResult(result);
  }, [state, servingInput, barcode, applyResult]);

  const retryFraming = useCallback(() => setState({ step: 'framing' }), []);

  if (!permission) {
    // Mirrors ScannerScreen: don't flash a permission prompt while the async
    // check is still resolving.
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.dark.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.title}>Camera access needed</Text>
          <Text style={styles.body}>
            GoalScan needs the camera to photograph the nutrition label.
          </Text>
          {permission.canAskAgain ? (
            <View style={styles.actionSpacing}>
              <SecondaryButton label="Grant camera access" onPress={requestPermission} tone="dark" />
            </View>
          ) : (
            <Text style={styles.body}>
              Access was denied. Enable the camera for GoalScan in your device
              Settings to continue.
            </Text>
          )}
          <Pressable onPress={onCancel} hitSlop={8} style={styles.backLink}>
            <Text style={styles.backLinkText}>Back to scanner</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (state.step === 'working') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.dark.accent} size="large" />
          <Text style={styles.body}>Reading the label…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (state.step === 'needsServing') {
    return (
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.formWrap}>
            <Text style={styles.title}>{state.productName ?? 'This label'} lists values per serving</Text>
            <Text style={styles.body}>
              The panel doesn't print a serving size, so its numbers can't be
              safely converted yet. Enter the serving size in grams from the
              label to finish scoring it.
            </Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              placeholder="Serving size in grams"
              placeholderTextColor={colors.dark.muted}
              value={servingInput}
              onChangeText={setServingInput}
              accessibilityLabel="Serving size in grams"
            />
            {servingError && <Text style={styles.errorText}>{servingError}</Text>}
            <View style={styles.actionSpacing}>
              <SecondaryButton label="Use this serving size" onPress={handleSubmitServing} tone="dark" />
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (state.step === 'failed') {
    const isUnreadable = state.reason === 'unreadable';
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.title}>
            {isUnreadable ? "Couldn't read that label" : "Couldn't complete that scan"}
          </Text>
          <Text style={styles.body}>
            {isUnreadable
              ? 'Make sure the whole nutrition panel is in frame, well lit, and in focus, then try again.'
              // Surfaced verbatim from scanLabel — e.g. "Could not reach the
              // label service. Is the proxy running?" — rather than replaced
              // with something generic, so a real setup problem stays
              // diagnosable instead of looking identical to a bad photo.
              : state.message}
          </Text>
          <View style={styles.actionSpacing}>
            <SecondaryButton label="Try again" onPress={retryFraming} tone="dark" />
          </View>
          {!isUnreadable && (
            <Pressable onPress={onCancel} hitSlop={8} style={styles.backLink}>
              <Text style={styles.backLinkText}>Back to scanner</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // framing
  return (
    <SafeAreaView style={styles.safe}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.topBar}>
          <Pressable style={styles.cancelButton} onPress={onCancel} hitSlop={8}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        </View>

        <View style={styles.centerWrap} pointerEvents="none">
          {/* Portrait-ish, not the scanner's wide barcode reticle — a
              nutrition panel is a tall rectangle, and a guide shaped like the
              thing it's guiding toward is the whole point of a guide. */}
          <View style={styles.guide} />
          <Text style={styles.title}>Fill the frame with the nutrition label</Text>
          <Text style={styles.hint}>Hold steady in good light for a clean read.</Text>
          {/* Said before the photo is taken, not buried in a policy. This is
              the only point in the app where anything leaves the device, so
              it's the only point where it needs saying. */}
          <Text style={styles.privacyNote}>
            The photo is sent off your phone to be read, and isn't saved by GoalScan.
          </Text>
        </View>

        <View style={styles.bottomBar}>
          <Pressable
            onPress={handleCapture}
            style={styles.shutterOuter}
            accessibilityRole="button"
            accessibilityLabel="Take photo"
          >
            <View style={styles.shutterInner} />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const GUIDE_WIDTH = 230;
const GUIDE_HEIGHT = 320;
const SHUTTER_OUTER = 76;
const SHUTTER_INNER = 58;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.dark.bg },
  flex: { flex: 1 },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  cancelButton: {
    backgroundColor: colors.dark.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.dark.border,
  },
  cancelButtonText: { ...type.small, color: colors.dark.text },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  guide: {
    width: GUIDE_WIDTH,
    height: GUIDE_HEIGHT,
    borderRadius: radii.md,
    borderWidth: 3,
    borderColor: colors.dark.accent,
    marginBottom: spacing.lg,
  },
  title: { ...type.h2, color: colors.dark.text, textAlign: 'center' },
  privacyNote: {
    ...type.small,
    color: colors.dark.muted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  hint: { ...type.small, color: colors.dark.muted, textAlign: 'center', marginTop: spacing.xs },
  bottomBar: {
    minHeight: spacing.xxl * 2,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: spacing.xl,
  },
  shutterOuter: {
    width: SHUTTER_OUTER,
    height: SHUTTER_OUTER,
    borderRadius: radii.pill,
    borderWidth: 4,
    borderColor: colors.dark.accent,
    backgroundColor: colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: SHUTTER_INNER,
    height: SHUTTER_INNER,
    borderRadius: radii.pill,
    backgroundColor: colors.dark.accent,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  formWrap: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  body: { ...type.body, color: colors.dark.muted },
  actionSpacing: { marginTop: spacing.md },
  backLink: { alignItems: 'center', marginTop: spacing.xl, paddingVertical: spacing.sm },
  backLinkText: { ...type.body, color: colors.dark.muted, textDecorationLine: 'underline' },
  input: {
    ...type.body,
    color: colors.dark.text,
    backgroundColor: colors.dark.surface,
    borderWidth: 1,
    borderColor: colors.dark.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  errorText: { ...type.small, color: colors.dark.skip, marginTop: spacing.xs },
});
