// Small DOM helpers shared by the WIWI form (app.js) and the trilogy stages (stages.js).

export const $ = (id) => document.getElementById(id);
export const isBlank = (text) => String(text ?? '').trim() === '';
