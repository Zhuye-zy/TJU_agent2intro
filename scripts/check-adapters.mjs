import { build } from 'vite';
await build({configFile:false,build:{outDir:'.runtime/adapter-build',emptyOutDir:true,minify:false,lib:{entry:{'map-budget':'frontend/src/transport/map-budget.ts',navigation:'frontend/src/transport/amap-navigation.ts',avatar:'frontend/src/avatar/adapter.ts',speech:'frontend/src/speech/adapter.ts'},formats:['es']},rollupOptions:{external:[]}}});
