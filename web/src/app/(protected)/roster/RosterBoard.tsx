"use client";

import { useMemo, useState } from "react";
import { AU_STATES, ROLES } from "@/lib/constants";
import { assignStaffToRole, moveAssignment, removeShift, setShiftStatus, unassignStaff } from "./actions";

interface CustomerRow {
  id: string;
  name: string;
  address: { state?: string } | null;
}
interface StaffRow {
  id: string;
  full_name: string;
  position: string | null;
}
interface ShiftRow {
  id: string;
  customer_id: string;
  start_time: string;
  shift_type: "hourly" | "container" | "rework";
  status: "draft" | "confirmed";
}
interface AssignmentRow {
  id: string;
  shift_id: string;
  staff_id: string;
  role: string;
}

const POOL = "__pool__";

interface DragPayload {
  staffId: string;
  from: string;
  assignmentId: string | null;
}

function availableRoles(shiftType: string): string[] {
  if (shiftType === "container") return ROLES.filter((r) => r !== "LO Driver");
  return [...ROLES];
}

function requiredRole(shiftType: string): string | null {
  return shiftType === "hourly" ? null : "Manager";
}

export function RosterBoard({
  customers,
  staff,
  shifts,
  assignments,
}: {
  customers: CustomerRow[];
  staff: StaffRow[];
  shifts: ShiftRow[];
  assignments: AssignmentRow[];
}) {
  const [selected, setSelected] = useState<DragPayload | null>(null);
  const [dragOverZone, setDragOverZone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const shiftById = useMemo(() => new Map(shifts.map((s) => [s.id, s])), [shifts]);
  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);

  const assignmentsByZone = useMemo(() => {
    const map = new Map<string, AssignmentRow[]>();
    for (const a of assignments) {
      const key = `${a.shift_id}::${a.role}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return map;
  }, [assignments]);

  const assignmentsByStaff = useMemo(() => {
    const map = new Map<string, AssignmentRow[]>();
    for (const a of assignments) {
      if (!map.has(a.staff_id)) map.set(a.staff_id, []);
      map.get(a.staff_id)!.push(a);
    }
    return map;
  }, [assignments]);

  function zoneLabel(zoneKey: string): string {
    if (zoneKey === POOL) return "the pool";
    const [shiftId, role] = zoneKey.split("::");
    const shift = shiftById.get(shiftId);
    const customer = shift ? customerById.get(shift.customer_id) : null;
    return `${customer?.name ?? "?"} · ${role}`;
  }

  function isConfirmedZone(zoneKey: string): boolean {
    if (zoneKey === POOL) return false;
    const shiftId = zoneKey.split("::")[0];
    return shiftById.get(shiftId)?.status === "confirmed";
  }

  function findConflict(staffId: string, targetShiftId: string, excludeAssignmentId: string | null): string | null {
    const targetShift = shiftById.get(targetShiftId);
    if (!targetShift) return null;
    for (const a of assignmentsByStaff.get(staffId) ?? []) {
      if (a.id === excludeAssignmentId) continue;
      if (a.shift_id === targetShiftId) return `${a.shift_id}::${a.role}`;
      const otherShift = shiftById.get(a.shift_id);
      if (otherShift && otherShift.start_time === targetShift.start_time) {
        return `${a.shift_id}::${a.role}`;
      }
    }
    return null;
  }

  async function tryAssign(staffId: string, targetZoneKey: string, fromZoneKey: string | null, fromAssignmentId: string | null) {
    if (targetZoneKey === fromZoneKey) return;

    if (targetZoneKey === POOL) {
      if (fromAssignmentId) {
        setBusy(true);
        await unassignStaff(fromAssignmentId);
        setBusy(false);
      }
      return;
    }

    if (isConfirmedZone(targetZoneKey)) {
      setMessage(`${zoneLabel(targetZoneKey)} is confirmed — unlock it first to make changes.`);
      return;
    }
    if (fromZoneKey && fromZoneKey !== POOL && isConfirmedZone(fromZoneKey)) {
      setMessage(`${zoneLabel(fromZoneKey)} is confirmed — unlock it first to move staff.`);
      return;
    }

    const [targetShiftId, targetRole] = targetZoneKey.split("::");
    const conflictZone = findConflict(staffId, targetShiftId, fromAssignmentId);
    if (conflictZone) {
      setMessage(`Already assigned to ${zoneLabel(conflictZone)} at the same time.`);
      return;
    }

    setMessage(null);
    setBusy(true);
    if (fromAssignmentId) {
      await moveAssignment(fromAssignmentId, targetShiftId, targetRole);
    } else {
      await assignStaffToRole(targetShiftId, staffId, targetRole);
    }
    setBusy(false);
  }

  function handleChipClick(staffId: string, zoneKey: string, assignmentId: string | null, locked: boolean) {
    if (locked) return;
    const isSame = selected?.staffId === staffId && selected?.from === zoneKey;
    if (isSame) {
      setSelected(null);
    } else {
      setSelected({ staffId, from: zoneKey, assignmentId });
    }
  }

  function handleZoneClick(zoneKey: string, locked: boolean) {
    if (locked || !selected) return;
    tryAssign(selected.staffId, zoneKey, selected.from, selected.assignmentId);
    setSelected(null);
  }

  const rosteredStaffIds = new Set(assignments.map((a) => a.staff_id));
  const unassignedStaff = staff.filter((s) => !rosteredStaffIds.has(s.id));
  const rosteredStaff = staff.filter((s) => rosteredStaffIds.has(s.id));

  const customersByState = new Map<string, CustomerRow[]>();
  for (const c of customers) {
    const state = c.address?.state || "Other";
    if (!customersByState.has(state)) customersByState.set(state, []);
    customersByState.get(state)!.push(c);
  }

  return (
    <div className="flex gap-6 items-start">
      <aside className="w-56 shrink-0 border border-border rounded p-3 flex flex-col gap-3">
        <PoolZone
          title={`Unassigned (${unassignedStaff.length})`}
          staffList={unassignedStaff}
          selected={selected}
          dragOverZone={dragOverZone}
          setDragOverZone={setDragOverZone}
          onChipClick={handleChipClick}
          tryAssign={tryAssign}
          assignmentsByStaff={assignmentsByStaff}
          zoneLabel={zoneLabel}
        />
        <PoolZone
          title={`Rostered today (${rosteredStaff.length})`}
          staffList={rosteredStaff}
          selected={selected}
          dragOverZone={dragOverZone}
          setDragOverZone={setDragOverZone}
          onChipClick={handleChipClick}
          tryAssign={tryAssign}
          assignmentsByStaff={assignmentsByStaff}
          zoneLabel={zoneLabel}
        />
      </aside>

      <div className="flex-1 flex flex-col gap-6">
        {message && (
          <div className="text-sm text-warning-text border border-border rounded p-2">{message}</div>
        )}
        {busy && <div className="text-xs text-text-muted">Saving…</div>}

        {AU_STATES.map((st) => {
          const group = customersByState.get(st);
          if (!group || group.length === 0) return null;
          return (
            <div key={st} className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-text-secondary">{st}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {group.map((customer) => (
                  <CustomerColumn
                    key={customer.id}
                    customer={customer}
                    shifts={shifts.filter((s) => s.customer_id === customer.id)}
                    assignmentsByZone={assignmentsByZone}
                    staffById={staffById}
                    selected={selected}
                    dragOverZone={dragOverZone}
                    setDragOverZone={setDragOverZone}
                    onChipClick={handleChipClick}
                    onZoneClick={handleZoneClick}
                    tryAssign={tryAssign}
                  />
                ))}
              </div>
            </div>
          );
        })}
        {customers.length === 0 && (
          <p className="text-sm text-text-secondary">Add customers on the Customers tab first.</p>
        )}
      </div>
    </div>
  );
}

function PoolZone({
  title,
  staffList,
  selected,
  dragOverZone,
  setDragOverZone,
  onChipClick,
  tryAssign,
  assignmentsByStaff,
  zoneLabel,
}: {
  title: string;
  staffList: StaffRow[];
  selected: DragPayload | null;
  dragOverZone: string | null;
  setDragOverZone: (z: string | null) => void;
  onChipClick: (staffId: string, zoneKey: string, assignmentId: string | null, locked: boolean) => void;
  tryAssign: (staffId: string, target: string, from: string | null, assignmentId: string | null) => void;
  assignmentsByStaff: Map<string, AssignmentRow[]>;
  zoneLabel: (zoneKey: string) => string;
}) {
  const isDragOver = dragOverZone === POOL;

  return (
    <div>
      <div className="text-xs font-semibold text-text-muted mb-1">{title}</div>
      <ul
        onDragOver={(e) => {
          e.preventDefault();
          setDragOverZone(POOL);
        }}
        onDragLeave={() => setDragOverZone(null)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOverZone(null);
          try {
            const payload: DragPayload = JSON.parse(e.dataTransfer.getData("text/plain"));
            tryAssign(payload.staffId, POOL, payload.from, payload.assignmentId);
          } catch {
            // ignore malformed drag payloads
          }
        }}
        onClick={() => {
          if (selected) tryAssign(selected.staffId, POOL, selected.from, selected.assignmentId);
        }}
        className={`flex flex-col gap-1 min-h-8 rounded p-1 ${isDragOver ? "bg-hover" : ""}`}
      >
        {staffList.length === 0 && <li className="text-xs text-text-muted px-1">None</li>}
        {staffList.map((s) => {
          const tags = (assignmentsByStaff.get(s.id) ?? []).map((a) => zoneLabel(`${a.shift_id}::${a.role}`));
          const isSelected = selected?.staffId === s.id && selected?.from === POOL;
          return (
            <li
              key={s.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  "text/plain",
                  JSON.stringify({ staffId: s.id, from: POOL, assignmentId: null })
                );
              }}
              onClick={(e) => {
                e.stopPropagation();
                onChipClick(s.id, POOL, null, false);
              }}
              className={`text-sm border border-border rounded px-2 py-1 cursor-grab ${isSelected ? "ring-2 ring-foreground" : ""}`}
            >
              <div>{s.full_name}</div>
              {tags.length > 0 && <div className="text-xs text-text-muted">{tags.join(" · ")}</div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CustomerColumn({
  customer,
  shifts,
  assignmentsByZone,
  staffById,
  selected,
  dragOverZone,
  setDragOverZone,
  onChipClick,
  onZoneClick,
  tryAssign,
}: {
  customer: CustomerRow;
  shifts: ShiftRow[];
  assignmentsByZone: Map<string, AssignmentRow[]>;
  staffById: Map<string, StaffRow>;
  selected: DragPayload | null;
  dragOverZone: string | null;
  setDragOverZone: (z: string | null) => void;
  onChipClick: (staffId: string, zoneKey: string, assignmentId: string | null, locked: boolean) => void;
  onZoneClick: (zoneKey: string, locked: boolean) => void;
  tryAssign: (staffId: string, target: string, from: string | null, assignmentId: string | null) => void;
}) {
  return (
    <div className="border border-border rounded p-3 flex flex-col gap-3">
      <h3 className="font-semibold">{customer.name}</h3>
      {shifts.length === 0 && <p className="text-xs text-text-secondary">No shifts today.</p>}
      {shifts.map((shift) => (
        <ShiftBlock
          key={shift.id}
          shift={shift}
          assignmentsByZone={assignmentsByZone}
          staffById={staffById}
          selected={selected}
          dragOverZone={dragOverZone}
          setDragOverZone={setDragOverZone}
          onChipClick={onChipClick}
          onZoneClick={onZoneClick}
          tryAssign={tryAssign}
        />
      ))}
    </div>
  );
}

function ShiftBlock({
  shift,
  assignmentsByZone,
  staffById,
  selected,
  dragOverZone,
  setDragOverZone,
  onChipClick,
  onZoneClick,
  tryAssign,
}: {
  shift: ShiftRow;
  assignmentsByZone: Map<string, AssignmentRow[]>;
  staffById: Map<string, StaffRow>;
  selected: DragPayload | null;
  dragOverZone: string | null;
  setDragOverZone: (z: string | null) => void;
  onChipClick: (staffId: string, zoneKey: string, assignmentId: string | null, locked: boolean) => void;
  onZoneClick: (zoneKey: string, locked: boolean) => void;
  tryAssign: (staffId: string, target: string, from: string | null, assignmentId: string | null) => void;
}) {
  const locked = shift.status === "confirmed";
  const roles = availableRoles(shift.shift_type);
  const required = requiredRole(shift.shift_type);
  const hasRequired = !required || (assignmentsByZone.get(`${shift.id}::${required}`)?.length ?? 0) > 0;

  return (
    <div className={`border rounded p-2 flex flex-col gap-2 ${locked ? "border-border opacity-90" : "border-border"}`}>
      <div className="flex items-center justify-between text-sm">
        <span>
          {shift.shift_type} · {shift.start_time} ·{" "}
          <span className={locked ? "text-success-text" : "text-warning-text"}>{shift.status}</span>
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setShiftStatus(shift.id, locked ? "draft" : "confirmed")}
            disabled={!locked && !hasRequired}
            title={!locked && !hasRequired ? `Needs a ${required} assigned before confirming` : undefined}
            className="text-xs"
          >
            {locked ? "Unlock" : "Confirm"}
          </button>
          {!locked && (
            <button onClick={() => removeShift(shift.id)} className="text-xs text-danger-text">
              Remove
            </button>
          )}
        </div>
      </div>

      {roles.map((role) => {
        const zoneKey = `${shift.id}::${role}`;
        const zoneAssignments = assignmentsByZone.get(zoneKey) ?? [];
        const isDragOver = dragOverZone === zoneKey;
        return (
          <div key={role}>
            <div className="text-xs text-text-muted">
              {role}
              {role === required ? " *" : ""}
            </div>
            <ul
              onDragOver={(e) => {
                if (locked) return;
                e.preventDefault();
                setDragOverZone(zoneKey);
              }}
              onDragLeave={() => setDragOverZone(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverZone(null);
                if (locked) return;
                try {
                  const payload: DragPayload = JSON.parse(e.dataTransfer.getData("text/plain"));
                  tryAssign(payload.staffId, zoneKey, payload.from, payload.assignmentId);
                } catch {
                  // ignore malformed drag payloads
                }
              }}
              onClick={() => onZoneClick(zoneKey, locked)}
              className={`flex flex-col gap-1 min-h-8 rounded p-1 border border-dashed ${
                isDragOver ? "bg-hover border-foreground" : "border-border"
              }`}
            >
              {zoneAssignments.length === 0 && (
                <li className="text-xs text-text-muted px-1">{locked ? "—" : "Drag staff here"}</li>
              )}
              {zoneAssignments.map((a) => {
                const person = staffById.get(a.staff_id);
                const isSelected = selected?.staffId === a.staff_id && selected?.from === zoneKey;
                return (
                  <li
                    key={a.id}
                    draggable={!locked}
                    onDragStart={(e) => {
                      e.dataTransfer.setData(
                        "text/plain",
                        JSON.stringify({ staffId: a.staff_id, from: zoneKey, assignmentId: a.id })
                      );
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onChipClick(a.staff_id, zoneKey, a.id, locked);
                    }}
                    className={`text-sm border border-border rounded px-2 py-1 flex justify-between items-center gap-2 ${
                      locked ? "" : "cursor-grab"
                    } ${isSelected ? "ring-2 ring-foreground" : ""}`}
                  >
                    <span>{person?.full_name ?? "?"}</span>
                    {!locked && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          unassignStaff(a.id);
                        }}
                        className="text-danger-text text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
