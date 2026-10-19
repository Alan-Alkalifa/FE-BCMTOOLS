<script setup lang="ts">
/** Downloads of the saved assessment: the PDF report and the filled SCCA Tools V4.2 workbook. */
defineProps<{ assessmentId: number }>()
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <UButton
      :to="sccaReportUrl(assessmentId, 'pdf')"
      external
      download
      color="neutral"
      variant="outline"
      icon="i-lucide-download"
      label="Download PDF"
    />
    <UButton
      :to="sccaReportUrl(assessmentId, 'xlsx')"
      external
      download
      color="neutral"
      variant="outline"
      icon="i-lucide-download"
      label="Download Excel"
    />
  </div>
</template>
