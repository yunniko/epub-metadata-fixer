"use client";

export function DownloadBlobButton({
  bytes,
  filename,
  mimeType,
  label,
}: {
  bytes: Uint8Array | null;
  filename: string;
  mimeType: string;
  label: string;
}) {
  function handleClick() {
    if (!bytes) return;
    const blob = new Blob([bytes.slice() as BlobPart], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!bytes}
      className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300"
    >
      {label}
    </button>
  );
}
