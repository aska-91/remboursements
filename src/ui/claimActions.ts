import type { Claim, Item } from "../domain/types";
import * as A from "../domain/actions";
import { itemRemaining } from "../domain/status";
import type { AppData } from "./useAppData";
import type { ActionConfig } from "./dialogs/ActionDialog";
import type { ConfirmConfig } from "./dialogs/ConfirmDialog";
import { strings } from "./strings";

export type DialogSpec =
  | { kind: "action"; cfg: ActionConfig }
  | { kind: "confirm"; cfg: ConfirmConfig }
  | { kind: "receipt"; claimId: string; itemId: string };

/** Everything a card (or the to-do list) can do. */
export interface ClaimActions {
  receive(c: Claim, i: Item): void;
  chase(c: Claim, i: Item): void;
  refuse(c: Claim, i: Item): void;
  writeOff(c: Claim, i: Item): void;
  undoReceipt(c: Claim, i: Item): void;
  reopenGap(c: Claim, i: Item): void;
  undoRefusal(c: Claim, i: Item): void;
  markReturned(c: Claim): void;
  markSent(c: Claim): void;
  addNote(c: Claim): void;
  cancel(c: Claim): void;
  restore(c: Claim): void;
  archive(c: Claim): void;
  unarchive(c: Claim): void;
  deleteForever(c: Claim): void;
  edit?(c: Claim): void;
}

export function makeClaimActions(
  data: AppData,
  open: (d: DialogSpec) => void,
  toast: (msg: string) => void,
  onEdit?: (c: Claim) => void,
): ClaimActions {
  const d = strings.dialog;
  const src = (i: Item) => strings.sources[i.source];
  const upd = data.updateClaim;
  return {
    receive: (c, i) => open({ kind: "receipt", claimId: c.id, itemId: i.id }),
    chase: (c, i) =>
      open({
        kind: "action",
        cfg: {
          title: d.chaseTitle(src(i)),
          info: d.chaseInfo(c.label, itemRemaining(c, i, data.today)),
          date: { label: d.chaseDate, value: data.today },
          text: { label: d.chaseText },
          date2: { label: d.chaseNewDue, value: i.due },
          okLabel: d.chaseOk,
          onOk: (v) => upd(c.id, (x, now) => A.recordChase(x, i.id, v.date, v.text, v.date2 === i.due ? "" : v.date2, now)),
        },
      }),
    refuse: (c, i) =>
      open({
        kind: "action",
        cfg: {
          title: d.refuseTitle,
          info: `${c.label} · ${src(i)}`,
          text: { label: d.refuseText, required: true },
          okLabel: d.refuseOk,
          onOk: (v) => upd(c.id, (x, now) => A.refuseItem(x, i.id, v.text, now)),
        },
      }),
    writeOff: (c, i) => {
      upd(c.id, (x, now) => A.writeOffGap(x, i.id, now));
      toast(strings.toast.writtenOff);
    },
    undoReceipt: (c, i) => upd(c.id, (x, now) => A.undoReceipt(x, i.id, now)),
    reopenGap: (c, i) => upd(c.id, (x, now) => A.reopenGap(x, i.id, now)),
    undoRefusal: (c, i) => upd(c.id, (x, now) => A.undoRefusal(x, i.id, now)),
    markReturned: (c) =>
      open({
        kind: "action",
        cfg: {
          title: d.returnedTitle,
          info: c.label,
          date: { label: d.returnedDate, value: data.today },
          text: { label: d.returnedTracking },
          date2: { label: d.returnedRefundDue, value: A.defaultRefundDue(data.today) },
          okLabel: d.returnedOk,
          onOk: (v) => upd(c.id, (x, now) => A.markReturned(x, v.date, v.text, v.date2, now)),
        },
      }),
    markSent: (c) =>
      open({
        kind: "action",
        cfg: {
          title: d.sentTitle,
          info: c.label,
          date: { label: d.sentDate, value: data.today },
          text: { label: d.sentText },
          okLabel: d.sentOk,
          onOk: (v) => upd(c.id, (x, now) => A.markSent(x, v.date, v.text, now)),
        },
      }),
    addNote: (c) =>
      open({
        kind: "action",
        cfg: {
          title: d.noteTitle,
          info: c.label,
          date: { label: d.noteDate, value: data.today },
          text: { label: d.noteText, required: true },
          okLabel: d.noteOk,
          onOk: (v) => upd(c.id, (x, now) => A.addNote(x, v.date, v.text, now)),
        },
      }),
    cancel: (c) =>
      open({
        kind: "action",
        cfg: {
          title: d.cancelTitle,
          info: d.cancelInfo(c.label),
          text: { label: d.cancelText, required: true },
          okLabel: d.cancelOk,
          onOk: (v) => upd(c.id, (x, now) => A.cancelClaim(x, v.text, now)),
        },
      }),
    restore: (c) => upd(c.id, (x, now) => A.restoreClaim(x, now)),
    archive: (c) => {
      upd(c.id, (x, now) => A.archiveClaim(x, data.today, now));
      toast(strings.toast.archived);
    },
    unarchive: (c) => upd(c.id, (x, now) => A.unarchiveClaim(x, now)),
    deleteForever: (c) =>
      open({
        kind: "confirm",
        cfg: {
          title: d.deleteTitle,
          message: d.deleteMessage(c.label),
          okLabel: d.deleteOk,
          danger: true,
          onOk: () => {
            data.updateDoc((doc, now) => A.deleteClaim(doc, c.id, now));
            toast(strings.toast.deleted);
          },
        },
      }),
    edit: onEdit,
  };
}
