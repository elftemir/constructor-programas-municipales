function up(db, { addColumnIfNotExists }) {
  for (const table of ['proyectos', 'fichas_municipios']) {
    const addedEs = addColumnIfNotExists(db, table, 'lema_es TEXT');
    const addedCa = addColumnIfNotExists(db, table, 'lema_ca TEXT');
    // Solo inicializar columnas nuevas; una repetición nunca pisa traducciones.
    if (table === 'proyectos') {
      if (addedEs) db.run("UPDATE proyectos SET lema_es = NULLIF(TRIM(lema), '') WHERE COALESCE(idioma_principal, 'es') <> 'ca'");
      if (addedCa) db.run("UPDATE proyectos SET lema_ca = NULLIF(TRIM(lema), '') WHERE idioma_principal = 'ca'");
    } else if (addedEs) db.run("UPDATE fichas_municipios SET lema_es = NULLIF(TRIM(lema), '')");
  }
}
module.exports = { version: 6, name: '006_lema_bilingue', up };
