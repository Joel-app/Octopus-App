export function DocumentField({
  label,
  name,
  signedUrl,
  accept,
}: {
  label: string;
  name: string;
  signedUrl: string | null;
  accept: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      {signedUrl && (
        <a href={signedUrl} target="_blank" rel="noreferrer" className="text-xs text-info-text w-fit">
          View current file
        </a>
      )}
      <input
        type="file"
        name={name}
        accept={accept}
        className="border border-border rounded px-2 py-1 bg-panel w-full text-xs"
      />
    </label>
  );
}
