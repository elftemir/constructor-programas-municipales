// Legacy entry point retained for compatibility; ordered delivery requires an approved report.
require('./entrega_ordenada');
if(require.main===module){console.error('Use npm run preparar-publicacion with workspace, publications, installable, report and content options. No legacy aliases are generated.');process.exitCode=1;}
