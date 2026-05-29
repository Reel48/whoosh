"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Player name search box — submits to /fantasy/players?q=… */
export function PlayerSearch({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/fantasy/players?q=${encodeURIComponent(q)}` : "/fantasy/players");
  }

  return (
    <form onSubmit={submit} className="ftb-wager">
      <input
        className="input"
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search by player name…"
        aria-label="Search players"
        autoComplete="off"
      />
      <button type="submit" className="btn btn-primary">
        Search
      </button>
    </form>
  );
}
