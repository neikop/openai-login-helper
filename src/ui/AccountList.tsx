import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { closestCenter, DndContext, DragOverlay, KeyboardSensor, PointerSensor, defaultDropAnimationSideEffects, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import type { AccountSummary } from './api';

interface Props {
  accounts: AccountSummary[];
  selectedId: string;
  busy: boolean;
  running: boolean;
  embedded: boolean;
  onSelect: (id: string) => void;
  onEdit: (account: AccountSummary) => void;
  onDelete: (account: AccountSummary) => void;
  onMove: (id: string, targetId: string, position: 'before' | 'after') => void;
}

const modifiers = [restrictToVerticalAxis];
const transition = { duration: 220, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' };
const dropAnimation = {
  ...transition,
  sideEffects: defaultDropAnimationSideEffects({ className: { active: 'account-placeholder' } })
};

function SortableAccount({ account, selectedId, busy, running, embedded, onSelect, onEdit, onDelete, canReorder, reducedMotion }: Omit<Props, 'accounts' | 'onMove'> & { account: AccountSummary; canReorder: boolean; reducedMotion: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition: rowTransition, isDragging } = useSortable({
    id: account.id,
    disabled: !canReorder,
    transition: reducedMotion ? null : transition
  });
  return <article ref={setNodeRef}
    className={`account ${account.id === selectedId ? 'selected' : ''} ${isDragging ? 'account-placeholder' : ''}`}
    style={{ transform: CSS.Transform.toString(transform), transition: rowTransition }}>
    <button ref={setActivatorNodeRef} className="drag-handle" type="button" disabled={!canReorder}
      {...attributes} {...listeners} aria-label={`Sắp xếp ${account.label || account.email}`}
      title="Kéo để sắp xếp · Space để nhấc/thả, ↑ ↓ để di chuyển, Esc để hủy">
      <span aria-hidden="true">⠿</span>
    </button>
    <label className="account-choice" title={account.label ? `${account.label} (${account.email})` : account.email}>
      <input type="radio" name="account" checked={account.id === selectedId} onChange={() => onSelect(account.id)} disabled={busy || running} />
      <span className="account-info"><strong>{account.label || account.email}</strong></span>
    </label>
    {!embedded ? <div className="row-actions">
      <button className="text-button" disabled={busy} aria-label={`Sửa ${account.email}`} onClick={() => onEdit(account)}>Sửa</button>
      <button className="text-button danger" disabled={busy} aria-label={`Xóa ${account.email}`} onClick={() => onDelete(account)}>Xóa</button>
    </div> : null}
  </article>;
}

export function AccountList(props: Props) {
  const { accounts, selectedId, busy, running, embedded, onMove } = props;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const changed = () => setReducedMotion(media.matches);
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const activeAccount = accounts.find(account => account.id === activeId);
  const canReorder = !busy && !running && accounts.length > 1;
  function finishDrag({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!canReorder || !over || active.id === over.id) return;
    const from = accounts.findIndex(account => account.id === active.id);
    const to = accounts.findIndex(account => account.id === over.id);
    if (from < 0 || to < 0) return;
    onMove(String(active.id), String(over.id), from < to ? 'after' : 'before');
  }
  return <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={modifiers}
    accessibility={{ screenReaderInstructions: { draggable: 'Nhấn Space để nhấc tài khoản, mũi tên lên xuống để di chuyển, Space để thả, Escape để hủy.' } }}
    onDragStart={({ active }) => setActiveId(String(active.id))}
    onDragCancel={() => setActiveId(null)} onDragEnd={finishDrag}>
    <SortableContext items={accounts.map(account => account.id)} strategy={verticalListSortingStrategy}>
      <div className="account-list" role="group" aria-label="Chọn tài khoản đăng nhập">
        {accounts.map(account => <SortableAccount key={account.id} {...props} account={account} canReorder={canReorder} reducedMotion={reducedMotion} />)}
      </div>
    </SortableContext>
    {createPortal(<DragOverlay dropAnimation={reducedMotion ? null : dropAnimation}>
      {activeAccount ? <div className={`account account-overlay ${activeId === selectedId ? 'selected' : ''}`} aria-hidden="true">
        <span className="drag-handle">⠿</span>
        <span className={`overlay-radio ${activeId === selectedId ? 'checked' : ''}`} />
        <span className="account-info"><strong>{activeAccount.label || activeAccount.email}</strong></span>
        {!embedded ? <div className="row-actions"><span className="text-button">Sửa</span><span className="text-button danger">Xóa</span></div> : null}
      </div> : null}
    </DragOverlay>, document.body)}
  </DndContext>;
}
