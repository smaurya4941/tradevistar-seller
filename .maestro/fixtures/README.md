# Fixtures

Four one-page PDFs the Phase 3 upload flows pick through the system file picker. The document
scanner needs a camera, so the flows use "Choose PDF" instead. Push them to the device first:

    adb push .maestro/fixtures/. /sdcard/Download/

Each file is a minimal PDF 1.4 document with one line of text.
