# QR Code Packing List Sharing Feature

This plan outlines the implementation of a QR code feature to export and import packing lists (categories) within the NOMAD application.

## Objective
Enable users to:
1.  Export a specific packing list category to a QR code.
2.  Import a packing list by scanning a QR code using the device's camera.

## Key Files & Context
-   `client/package.json`: Add `react-qr-code` and `html5-qrcode` dependencies.
-   `client/src/components/Packing/PackingListPanel.tsx`: Add "Export to QR code" to the category's 3-dots menu and "Scan QR code" to the Import modal.
-   `client/src/utils/qrUtils.ts`: (New) Utilities for encoding/decoding packing list data.
-   `client/src/components/shared/QRScannerModal.tsx`: (New) Component for scanning QR codes.
-   `client/src/components/shared/QRDisplayModal.tsx`: (New) Component for displaying generated QR codes.

## Implementation Steps

### 1. Dependencies
Add the following dependencies to the client:
-   `react-qr-code`: For generating QR codes.
-   `html5-qrcode`: For scanning QR codes via camera.

### 2. QR Data Format
To keep the QR code size small (so it remains easily scannable), we'll use a compact JSON format for packing lists:

```json
{
  "t": "p", // Type: packing
  "c": "Category Name",
  "i": [    // Items
    {"n": "Item Name"}
  ]
}
```

### 3. Create Utilities (`client/src/utils/qrUtils.ts`)
Implement functions to:
-   `encodePackingList(categoryName, items)`: Convert packing items to compact JSON.
-   `decodePackingList(data)`: Parse compact JSON back to packing items and category name.

### 4. Shared Components
-   **`QRDisplayModal.tsx`**: A simple modal that takes a string (the encoded list) and renders a QR code using `react-qr-code`.
-   **`QRScannerModal.tsx`**: A modal that uses `html5-qrcode` to access the camera and scan a QR code. On successful scan, it returns the decoded data and closes.

### 5. Integration in `PackingListPanel.tsx`
-   **Export:** In the `KategorieBlock` component, add a new `MenuItem` to the 3-dots (`MoreHorizontal`) dropdown menu. It will say "Export to QR Code" and open the `QRDisplayModal` containing the encoded items of that specific category.
-   **Import:** In the existing bulk import modal (`showImportModal`), add a button next to "Load CSV/TXT" that says "Scan QR Code". This button will open the `QRScannerModal`.
-   **Handling Scanned Data:** When the scanner returns data, we'll parse the category and items, and then use `addPackingItem` from `useTripStore` to add the items to the current trip, assigning them to the decoded category.

## Verification & Testing
-   **Export Test**: Create a packing category with several items, select "Export to QR Code" from the 3-dots menu, and ensure the QR code modal displays correctly.
-   **Import Test**: Open the Import menu, select "Scan QR Code", scan the generated QR code, and verify the items are correctly added under the right category.
-   **Error Handling**: Ensure the scanner handles invalid QR codes gracefully and shows a toast error message.
