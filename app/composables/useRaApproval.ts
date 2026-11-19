import RaCrisisNoteModal from '~/components/ra/RaCrisisNoteModal.vue'

/**
 * The approve / reject dialogs of the four-eyes approval of buildings, disasters and incidents,
 * shared by the banner on their pages, the Approve / Reject buttons in the Buildings list and
 * Disaster (Incident) › Approval. Each resolves to the note ('' without one) or false when cancelled.
 */
export function useRaApprovalDialogs() {
  const modal = useOverlay().create(RaCrisisNoteModal)

  function approve(noun: string, action?: 'register' | 'deactivate' | null) {
    return modal.open({
      title: action === 'deactivate' ? `Make this ${noun} inactive?` : `Approve this ${noun}?`,
      description: action === 'deactivate'
        ? `It leaves the ${noun} lists, the map and New assessment. Its RAs are kept.`
        : noun === 'disaster' || noun === 'incident'
          ? 'It opens: everyone affected sees it on the building map with their instructions.'
          : 'It becomes active: disasters and earthquakes then affect it.',
      confirmLabel: 'Approve',
      noteLabel: 'Comment',
      help: 'Optional. Kept with the approval.',
    }).result
  }

  function reject(noun: string, action?: 'register' | 'deactivate' | null) {
    return modal.open({
      title: `Reject ${action === 'deactivate' ? 'the deactivation' : `this ${noun}`}?`,
      description: action === 'deactivate'
        ? `The ${noun} stays active. The reason is shown to who asked.`
        : noun === 'disaster' || noun === 'incident'
          ? 'It leaves the map and stays in the list as rejected, with the reason.'
          : `Who added it sees the reason, fixes the ${noun} and submits it again.`,
      confirmLabel: 'Reject',
      noteLabel: 'Reason',
      required: true,
      destructive: true,
    }).result
  }

  return { approve, reject }
}
