/**
 * Link / change a Sleeper account. Plain progressive-enhancement form posting
 * to /api/fantasy/link (no JS required). The route redirects back with a
 * ?flink banner the host page can surface.
 */
export function LinkSleeperForm({
  current,
  next = "/fantasy",
}: {
  current?: string;
  next?: string;
}) {
  return (
    <form action="/api/fantasy/link" method="POST" className="ftb-wager">
      <input type="hidden" name="next" value={next} />
      <input
        className="input"
        type="text"
        name="username"
        defaultValue={current ?? ""}
        placeholder="Sleeper username"
        autoComplete="off"
        aria-label="Sleeper username"
        required
      />
      <button type="submit" className="btn btn-primary">
        {current ? "Update" : "Link account"}
      </button>
    </form>
  );
}
