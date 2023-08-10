export function Loading({ msg }: { msg?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-12">
      <h3>{msg || 'Loading'}</h3>
    </div>
  );
}
