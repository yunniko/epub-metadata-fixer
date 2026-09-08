"use client";

export function EpubFileInput({
  onFile,
  accept = ".epub,application/epub+zip",
  label = "Choose an .epub file",
}: {
  onFile: (file: File) => void;
  accept?: string;
  label?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-gray-700">{label}</span>
      <input
        type="file"
        accept={accept}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
        }}
        className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
      />
      <span className="mt-1 block text-xs text-gray-500">
        Processed entirely in your browser — the file is never uploaded anywhere.
      </span>
    </label>
  );
}
