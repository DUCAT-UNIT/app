// Mock for @gorhom/bottom-sheet
import React from 'react';
import { View, Modal, ScrollView } from 'react-native';

export const BottomSheetModal = React.forwardRef(({ children }: React.PropsWithChildren, _ref) =>
  React.createElement(Modal, { visible: false, transparent: true }, children)
);
BottomSheetModal.displayName = 'BottomSheetModal';

export const BottomSheet = React.forwardRef(({ children }: React.PropsWithChildren, _ref) =>
  React.createElement(View, null, children)
);
BottomSheet.displayName = 'BottomSheet';

export const BottomSheetModalProvider = ({ children }: React.PropsWithChildren) =>
  React.createElement(React.Fragment, null, children);

export const BottomSheetBackdrop = View;
export const BottomSheetHandle = View;
export const BottomSheetView = View;
export const BottomSheetScrollView = ScrollView;
export const BottomSheetFlatList = View;
export const BottomSheetSectionList = View;
export const BottomSheetTextInput = View;

export const useBottomSheet = () => ({
  snapToIndex: () => {},
  snapToPosition: () => {},
  expand: () => {},
  collapse: () => {},
  close: () => {},
  forceClose: () => {},
});

export const useBottomSheetModal = () => ({
  dismiss: () => {},
  dismissAll: () => {},
});

export const useBottomSheetDynamicSnapPoints = () => ({
  animatedHandleHeight: { value: 0 },
  animatedSnapPoints: { value: [0] },
  animatedContentHeight: { value: 0 },
  handleContentLayout: () => {},
});

export default BottomSheet;
