"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Check, CircleCheck, Download, TriangleAlert, Upload } from "lucide-react";
import s from "@/app/styles/portal.module.css";
import { FormError } from "@/components/Field";
import { ico, icoXs } from "@/components/icon";
import { api } from "@/lib/client-api";

type RowResult = "new" | "unchanged" | "name_differs" | "error";
type PreviewRow = { row: number; indexNumber: string; name: string; error?: string; result: RowResult; rosterName?: string };
type Preview = { format: string; rows: PreviewRow[]; counts: Record<RowResult, number> };
type Saved = { added: number; renamed: number; skipped: number };
type Show = "all" | "look" | "new";

const TEMPLATE = "index_number,name\n220366X,Lokuhewa P. C.\n220720E,Wijesinghe L. A. V. B.\n";

function formatSize(bytes: number) {
  return bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`;
}

export function CsvImport({ moduleId, moduleShort }: { moduleId: string; moduleShort: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; size: number; text: string } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [update, setUpdate] = useState<Set<string>>(new Set());
  const [show, setShow] = useState<Show>("look");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [drag, setDrag] = useState(false);

  async function load(f: File) {
    setError(null);
    setSaved(null);
    setPreview(null);
    setUpdate(new Set());
    if (f.size > 512 * 1024) {
      setError("The file is too large. The limit is 512 KB.");
      return;
    }
    const text = await f.text();
    setFile({ name: f.name, size: f.size, text });
    setBusy(true);
    try {
      const p = await api<Preview>(`/modules/${moduleId}/students/import?dryRun=1`, { body: { csv: text } });
      setPreview(p);
      setShow(p.counts.name_differs + p.counts.error > 0 ? "look" : "all");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read the file. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!file || !preview) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<Saved>(`/modules/${moduleId}/students/import`, {
        body: { csv: file.text, updateNames: [...update] },
      });
      setSaved(res);
      setPreview(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the import. Nothing was saved. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([TEMPLATE], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "students_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const toSave = preview ? preview.counts.new + [...update].filter((i) => preview.rows.some((r) => r.indexNumber === i && r.result === "name_differs")).length : 0;
  const look = preview ? preview.counts.name_differs + preview.counts.error : 0;
  const visible = useMemo(() => {
    if (!preview) return [];
    if (show === "look") return preview.rows.filter((r) => r.result === "name_differs" || r.result === "error");
    if (show === "new") return preview.rows.filter((r) => r.result === "new");
    return preview.rows;
  }, [preview, show]);

  const step = saved ? 3 : preview ? 2 : 1;
  const stepItem = (n: number, label: string) => (
    <li className={step === n ? s.stepCurrent : undefined} aria-current={step === n ? "step" : undefined}>
      {step > n ? (
        <span className="lu-badge lu-badge--success">
          <Check {...icoXs} />
          {n}
        </span>
      ) : (
        <span className={`lu-badge ${step === n ? "lu-badge--brand" : ""}`}>{n}</span>
      )}
      {label}
    </li>
  );

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <h2 className={s.h1}>Import students</h2>
          <p className={s.sub}>Add many students to {moduleShort} at once. Nothing is saved until you confirm.</p>
        </div>
        <ol aria-label="Steps" className={s.steps}>
          {stepItem(1, "Upload")}
          <li aria-hidden className={s.stepLine} />
          {stepItem(2, "Check rows")}
          <li aria-hidden className={s.stepLine} />
          {stepItem(3, "Saved")}
        </ol>
      </div>

      <div className={s.split}>
        <div className={s.splitSide}>
          <section className={`${s.card} ${s.cardPad}`}>
            <h3 className={s.h2}>File</h3>
            <div
              className={`${s.dropzone} ${drag ? s.dropzoneActive : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                const f = e.dataTransfer.files[0];
                if (f) void load(f);
              }}
            >
              <span className={s.fileIcon}>CSV</span>
              <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                {file ? (
                  <>
                    <span className={`${s.strong} ${s.ellipsis}`}>{file.name}</span>
                    <span className={`${s.mono} ${s.muted}`}>
                      {preview ? `${preview.rows.length} rows · ` : ""}
                      {formatSize(file.size)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className={s.strong}>Choose a CSV file</span>
                    <span className={s.muted}>or drop it here</span>
                  </>
                )}
              </span>
              <button type="button" className="lu-btn lu-btn--sm" onClick={() => input.current?.click()} disabled={busy}>
                {file ? "Replace" : (
                  <>
                    <Upload {...ico} />
                    Choose
                  </>
                )}
              </button>
              <input
                ref={input}
                type="file"
                accept=".csv,text/csv"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void load(f);
                  e.target.value = "";
                }}
              />
            </div>
          </section>
          <section className={`${s.card} ${s.cardPad}`} style={{ gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 className={s.h2}>CSV format</h3>
              <button type="button" className="lu-btn lu-btn--sm lu-btn--ghost" style={{ color: "var(--brand)" }} onClick={downloadTemplate}>
                <Download {...ico} />
                Download template
              </button>
            </div>
            <pre className={s.code}>{TEMPLATE.trim()}</pre>
            <ul className={s.muted} style={{ margin: 0, paddingLeft: 18 }}>
              <li>Index number: 6 digits and a letter.</li>
              <li>Name: as the student should type it to register.</li>
              <li>A Moodle participants export works too (ID number, first name, last name).</li>
              <li>Up to 1,000 rows.</li>
            </ul>
          </section>
        </div>

        <div className={s.splitMain}>
          <FormError message={error} />
          {busy && !preview && <div className={s.muted}>Checking the file…</div>}

          {saved && (
            <div className="lu-notice lu-notice--success" role="status" style={{ maxWidth: "none" }}>
              <CircleCheck {...ico} />
              <span style={{ flex: 1 }}>
                <b>Import finished.</b> {saved.added} {saved.added === 1 ? "student" : "students"} added
                {saved.renamed ? `, ${saved.renamed} ${saved.renamed === 1 ? "name" : "names"} updated` : ""}
                {saved.skipped ? `, ${saved.skipped} ${saved.skipped === 1 ? "row" : "rows"} skipped` : ""}.
              </span>
              <Link className="lu-btn lu-btn--sm" href={`/modules/${moduleId}`}>
                View students
              </Link>
            </div>
          )}

          {!preview && !saved && !busy && (
            <div className={`${s.card} ${s.empty}`}>
              <span className={s.strong} style={{ color: "var(--ink)" }}>
                Choose a file to see what will change
              </span>
              <span>You&apos;ll see new students, name differences and errors before anything is saved.</span>
            </div>
          )}

          {preview && (
            <>
              <section aria-label="Summary" className={`${s.card} ${s.stats} ${s.statsTight}`}>
                <div className={s.stat}>
                  <div className={s.statLabel}>New students</div>
                  <div className={s.statValue}>{preview.counts.new}</div>
                  <span className="lu-badge lu-badge--success">Will be added</span>
                </div>
                <div className={s.stat}>
                  <div className={s.statLabel}>Already on the list</div>
                  <div className={s.statValue}>{preview.counts.unchanged}</div>
                  <span className="lu-badge">No change</span>
                </div>
                <div className={s.stat}>
                  <div className={s.statLabel}>Name differs</div>
                  <div className={s.statValue}>{preview.counts.name_differs}</div>
                  <span className="lu-badge lu-badge--warning">Choose one</span>
                </div>
                <div className={s.stat}>
                  <div className={s.statLabel}>Errors</div>
                  <div className={s.statValue}>{preview.counts.error}</div>
                  <span className="lu-badge lu-badge--danger">Will be skipped</span>
                </div>
              </section>

              {look > 0 && (
                <div className="lu-notice lu-notice--warning" role="status" style={{ maxWidth: "none" }}>
                  <TriangleAlert {...ico} />
                  <span>
                    <b>
                      {look} {look === 1 ? "row needs" : "rows need"} a look.
                    </b>{" "}
                    {preview.counts.name_differs > 0 &&
                      `Choose which name to keep for ${preview.counts.name_differs} ${preview.counts.name_differs === 1 ? "student" : "students"}. `}
                    {preview.counts.error > 0 &&
                      `${preview.counts.error} ${preview.counts.error === 1 ? "row" : "rows"} with errors will be skipped.`}
                  </span>
                </div>
              )}

              <section className={`${s.card} ${s.cardFlush}`}>
                <div className={s.cardHead}>
                  <h3 className={s.h2} style={{ marginLeft: 4 }}>
                    Check the rows
                  </h3>
                  <div role="group" aria-label="Show rows" className={s.segmented}>
                    {(
                      [
                        ["all", `All ${preview.rows.length}`],
                        ["look", `Needs a look ${look}`],
                        ["new", `New ${preview.counts.new}`],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        className={`lu-toggle ${show === key ? "is-on" : ""}`}
                        aria-pressed={show === key}
                        style={{ padding: "0 10px" }}
                        onClick={() => setShow(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={s.tableWrap} style={{ maxHeight: 520, overflowY: "auto" }}>
                  <table className={s.table} style={{ minWidth: 700 }}>
                    <thead>
                      <tr>
                        <th>Row</th>
                        <th>Index no.</th>
                        <th>Name in file</th>
                        <th>Result</th>
                        <th>What happens</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.length === 0 && (
                        <tr>
                          <td colSpan={5} className={s.muted} style={{ textAlign: "center", padding: 24 }}>
                            Nothing to show here.
                          </td>
                        </tr>
                      )}
                      {visible.map((r) => (
                        <tr key={r.row}>
                          <td className={`${s.mono} ${s.muted}`}>{r.row}</td>
                          <td className={s.mono}>{r.indexNumber || "(empty)"}</td>
                          <td className={r.name ? s.strong : s.muted}>{r.name || "(empty)"}</td>
                          <td>
                            {r.result === "new" && <span className="lu-badge lu-badge--success">New</span>}
                            {r.result === "unchanged" && <span className="lu-badge">On the list</span>}
                            {r.result === "name_differs" && (
                              <span className={s.cellStack}>
                                <span className="lu-badge lu-badge--warning">Name differs</span>
                                <span className={`${s.small} ${s.muted}`}>On your list: {r.rosterName}</span>
                              </span>
                            )}
                            {r.result === "error" && (
                              <span className={s.cellStack}>
                                <span className="lu-badge lu-badge--danger">Error</span>
                                <span className={s.small} style={{ color: "var(--danger)" }}>
                                  {r.error}
                                </span>
                              </span>
                            )}
                          </td>
                          <td>
                            {r.result === "new" && <span className={s.muted}>Added</span>}
                            {r.result === "unchanged" && <span className={s.muted}>No change</span>}
                            {r.result === "error" && <span className={s.muted}>Skipped. Fix the file or add by hand.</span>}
                            {r.result === "name_differs" && (
                              <span className={s.radios}>
                                <label className="lu-check">
                                  <input
                                    type="radio"
                                    name={`r${r.row}`}
                                    checked={!update.has(r.indexNumber)}
                                    onChange={() => {
                                      const next = new Set(update);
                                      next.delete(r.indexNumber);
                                      setUpdate(next);
                                    }}
                                  />
                                  Keep
                                </label>
                                <label className="lu-check">
                                  <input
                                    type="radio"
                                    name={`r${r.row}`}
                                    checked={update.has(r.indexNumber)}
                                    onChange={() => setUpdate(new Set(update).add(r.indexNumber))}
                                  />
                                  Update
                                </label>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className={`${s.cardFoot} ${s.cardFootSunken}`}>
                  <span>
                    <b>
                      {toSave} {toSave === 1 ? "student" : "students"}
                    </b>{" "}
                    will be saved
                    {preview.counts.error > 0 && (
                      <span className={s.muted}>
                        {" "}
                        · {preview.counts.error} {preview.counts.error === 1 ? "row" : "rows"} skipped
                      </span>
                    )}
                  </span>
                  <span className={s.actions}>
                    <Link className="lu-btn" href={`/modules/${moduleId}`}>
                      Cancel
                    </Link>
                    <button type="button" className="lu-btn lu-btn--primary" onClick={commit} disabled={busy || toSave === 0}>
                      {busy ? "Saving…" : `Import ${toSave} ${toSave === 1 ? "student" : "students"}`}
                    </button>
                  </span>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
}
