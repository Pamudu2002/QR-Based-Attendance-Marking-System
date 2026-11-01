import s from "@/app/styles/portal.module.css";
import { listRoster, rosterStats } from "@/server/roster";
import { AddStudentForm } from "./AddStudentForm";
import { loadModule } from "./load";
import { RegistrationPanel } from "./RegistrationPanel";
import { RosterTable } from "./RosterTable";

export const metadata = { title: "Students" };

export default async function StudentsTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { lecturer, mod } = await loadModule(id);
  const [{ rows }, stats] = await Promise.all([listRoster(lecturer.id, id), rosterStats(lecturer.id, id)]);
  const notRegistered = stats.total - stats.registered;
  const pct = stats.total ? Math.round((stats.registered / stats.total) * 100) : 0;

  return (
    <>
      <section aria-label="Summary" className={`${s.card} ${s.stats}`}>
        <div className={s.stat}>
          <div className={s.statLabel}>Added by you</div>
          <div className={s.statValue}>{stats.total}</div>
          <div className={`${s.small} ${s.muted}`}>
            {stats.csv} from CSV · {stats.manual} by hand
          </div>
        </div>
        <div className={s.stat}>
          <div className={s.statLabel}>Registered</div>
          <div className={s.statValue}>{stats.registered}</div>
          <span className="lu-badge lu-badge--success">{pct}% of the class</span>
        </div>
        <div className={s.stat}>
          <div className={s.statLabel}>Not registered yet</div>
          <div className={s.statValue}>{notRegistered}</div>
          {notRegistered > 0 ? (
            <span className="lu-badge lu-badge--warning">Show QR next class</span>
          ) : (
            <span className="lu-badge">Everyone is in</span>
          )}
        </div>
        <div className={s.stat}>
          <div className={s.statLabel}>Failed registrations today</div>
          <div className={s.statValue}>{stats.failedToday.length}</div>
          {stats.failedToday.length > 0 ? (
            <span className="lu-badge lu-badge--danger">See the list</span>
          ) : (
            <span className="lu-badge">None</span>
          )}
        </div>
      </section>

      <div className={s.split}>
        <div className={s.splitMain}>
          <RosterTable moduleId={id} rows={rows} />
        </div>
        <div className={s.splitSide}>
          <AddStudentForm moduleId={id} />
          <RegistrationPanel moduleId={id} open={mod.registrationOpen} failedToday={stats.failedToday} />
        </div>
      </div>
    </>
  );
}
