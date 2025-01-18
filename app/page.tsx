"use client";

import React, { useEffect, useState } from "react";

type GraphRecord = {
  id: string;
  name: string;
  createdAt: string;
};

export default function Home() {
  const [graphs, setGraphs] = useState<GraphRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGraphs = async () => {
    try {
      const res = await fetch("/api/graphs/list");
      if (!res.ok) throw new Error(`Failed to fetch, status=${res.status}`);
      const data = await res.json();
      setGraphs(data || []);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching graphs:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraphs();
  }, []);

  return (
    <main style={{ padding: "1rem" }}>
      <button
        className="bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded absolute top-4 left-4 z-50"
        onClick={() => {
          window.location.href = "/graph";
        }}
      >
        Realtime Tracing
      </button>

      {loading && <p>Loading...</p>}
      {!loading && graphs.length === 0 && (
        <p>No graphs found in DB.</p>
      )}
      {!loading && graphs.length > 0 && (
        <table style={{ borderCollapse: "collapse", width: "100%", marginTop: "1rem" }}>
          <thead>
          <tr style={{ borderBottom: "1px solid #ccc" }}>
            <th style={{ padding: "0.5rem" }}>ID</th>
            <th style={{ padding: "0.5rem" }}>Name</th>
            <th style={{ padding: "0.5rem" }}>CreatedAt</th>
            <th style={{ padding: "0.5rem" }}>Link</th>
          </tr>
          </thead>
          <tbody>
          {graphs.map((g) => (
            <tr key={g.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "0.5rem" }}>{g.id}</td>
              <td style={{ padding: "0.5rem" }}>{g.name}</td>
              <td style={{ padding: "0.5rem" }}>{new Date(g.createdAt).toLocaleString()}</td>
              <td style={{ padding: "0.5rem" }}>
                <a href={`/graph?graphId=${g.id}`} style={{ color: "blue", textDecoration: "underline" }}>
                  Open
                </a>
              </td>
            </tr>
          ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
