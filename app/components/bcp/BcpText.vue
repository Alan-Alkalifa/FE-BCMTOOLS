<script setup lang="ts">
/** BCP configuration text: paragraphs, and lines starting with "- " as bullets. */
const props = defineProps<{ text: string | null | undefined }>()

const blocks = computed(() => {
  const result: { kind: 'p' | 'ul', lines: string[] }[] = []
  for (const raw of (props.text ?? '').split('\n')) {
    const line = raw.trimEnd()
    if (!line.trim()) continue
    const bullet = line.trimStart().startsWith('- ')
    const kind = bullet ? 'ul' : 'p'
    const text = bullet ? line.trimStart().slice(2) : line
    const last = result.at(-1)
    if (kind === 'ul' && last?.kind === 'ul') last.lines.push(text)
    else result.push({ kind, lines: [text] })
  }
  return result
})
</script>

<template>
  <div class="space-y-2 text-sm">
    <template
      v-for="(block, index) in blocks"
      :key="index"
    >
      <ul
        v-if="block.kind === 'ul'"
        class="list-disc space-y-1 ps-5"
      >
        <li
          v-for="(line, lineIndex) in block.lines"
          :key="lineIndex"
        >
          {{ line }}
        </li>
      </ul>
      <p v-else>
        {{ block.lines[0] }}
      </p>
    </template>
  </div>
</template>
