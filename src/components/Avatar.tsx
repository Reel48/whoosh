/** Discord avatar — uses the CDN URL when a hash is present, otherwise renders
 *  the default avatar for that user ID. Server-renderable. */
export function Avatar({
  id,
  hash,
  username,
  size = 32,
  className = "",
}: {
  id: string;
  hash?: string | null;
  username: string;
  size?: number;
  className?: string;
}) {
  let src: string;
  if (hash) {
    src = `https://cdn.discordapp.com/avatars/${id}/${hash}.png?size=64`;
  } else {
    // New Discord default-avatar scheme for username-system users.
    let idx = 0;
    try {
      idx = Number((BigInt(id) >> BigInt(22)) % BigInt(6));
    } catch {
      /* fall back to 0 */
    }
    src = `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={username}
      width={size}
      height={size}
      className={`rounded-full ${className}`}
    />
  );
}
