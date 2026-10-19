import ConfirmDialog from '~/components/ConfirmDialog.vue'

type ConfirmOptions = InstanceType<typeof ConfirmDialog>['$props']

/** Opens a <ConfirmDialog> and resolves to true when the user confirms. */
export function useConfirm() {
  const dialog = useOverlay().create(ConfirmDialog)
  return async (options: ConfirmOptions) => (await dialog.open(options).result) === true
}
