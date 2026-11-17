<script setup lang="ts">
/** Input building data from Master data › Master building: saved, the building opens in
 *  Master building. */
definePageMeta({ permission: ['location.master'] })
</script>

<template>
  <RaNewLocationPage master />
</template>
