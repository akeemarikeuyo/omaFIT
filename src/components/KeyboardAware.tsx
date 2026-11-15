// Keeps what the user is typing above the keyboard. Android draws the app edge to edge, so the keyboard no longer
// shrinks the screen by itself: these components add room for it and scroll the focused field into view.
// They measure on screen (not with fixed offsets), so they work under a header, above a tab bar, or both.
import React, { ComponentRef, ReactNode, RefObject, useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  ScrollViewInstance,
  ScrollViewProps,
  StyleProp,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';

type ViewRef = ComponentRef<typeof View>;

/** Space between the focused field and the top of the keyboard */
const GAP = 24;

const SHOW = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
const HIDE = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

/**
 * How much of the view at `ref` the keyboard covers, as bottom padding. `onShown` runs after the padding is
 * applied, with the keyboard's top edge on screen.
 */
function useKeyboardInset(ref: RefObject<ViewRef | null>, onShown?: (keyboardTop: number) => void) {
  const [inset, setInset] = useState(0);
  const shown = useRef(onShown);
  useEffect(() => {
    shown.current = onShown;
  });

  useEffect(() => {
    const show = Keyboard.addListener(SHOW, (e: KeyboardEvent) => {
      const keyboardTop = e.endCoordinates.screenY;
      ref.current?.measureInWindow((_x, y, _w, height) => {
        setInset(Math.max(0, y + height - keyboardTop));
        // Let the padding lay out before scrolling
        setTimeout(() => shown.current?.(keyboardTop), 50);
      });
    });
    const hide = Keyboard.addListener(HIDE, () => setInset(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [ref]);

  return inset;
}

/** A plain view that makes room for the keyboard, e.g. a chat screen with its input bar at the bottom. */
export function KeyboardAvoider({
  children,
  style,
  onKeyboardShown,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onKeyboardShown?: () => void;
}) {
  const ref = useRef<ViewRef>(null);
  const inset = useKeyboardInset(ref, onKeyboardShown);
  return (
    <View ref={ref} style={[{ flex: 1 }, style, { paddingBottom: inset }]}>
      {children}
    </View>
  );
}

/**
 * A ScrollView for forms. Makes room for the keyboard and scrolls the field being typed in to just above it.
 * Takes the same props as ScrollView; `style` applies to the outer view.
 */
export function KeyboardAwareScrollView({ children, style, onScroll, ...props }: ScrollViewProps) {
  const outer = useRef<ViewRef>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  const scrollY = useRef(0);

  const revealFocused = useCallback((keyboardTop: number) => {
    const field = TextInput.State.currentlyFocusedInput();
    if (!field) return;
    field.measureInWindow((_x, y, _w, height) => {
      const overlap = y + height - (keyboardTop - GAP);
      if (overlap > 0) scroll.current?.scrollTo({ y: scrollY.current + overlap, animated: true });
    });
  }, []);

  const inset = useKeyboardInset(outer, revealFocused);

  const trackScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = e.nativeEvent.contentOffset.y;
    onScroll?.(e);
  };

  return (
    <View ref={outer} style={[{ flex: 1 }, style, { paddingBottom: inset }]}>
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        // iOS number pads have no Done key: swiping down (or tapping outside a field) closes the keyboard
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        {...props}
        onScroll={trackScroll}
        scrollEventThrottle={16}
      >
        {children}
      </ScrollView>
    </View>
  );
}
