export function Error({ msg }: { msg?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-12">
      <h3>{msg || 'Error'}</h3>
    </div>
  );
}
