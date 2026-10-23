import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ownerWhatsAppContact } from '../src/lib/owner-whatsapp.ts';

for (const [time, greeting, open] of [
  ['00:00', 'malam', false], ['03:59', 'malam', false], ['04:00', 'pagi', false],
  ['08:59', 'pagi', false], ['09:00', 'pagi', true], ['10:59', 'pagi', true],
  ['11:00', 'siang', true], ['14:59', 'siang', true], ['15:00', 'sore', true],
  ['17:59', 'sore', true], ['18:00', 'malam', true], ['19:59', 'malam', true],
  ['20:00', 'malam', false], ['23:59', 'malam', false],
]) {
  test(`WITA ${time}: ${greeting}, working hours ${open}`, () => {
    const contact = ownerWhatsAppContact('Kopi & Roti', new Date(`2026-10-24T${time}:00+08:00`));
    assert.equal(contact.isWorkingHours, open);
    const url = new URL(contact.url);
    assert.equal(url.origin + url.pathname, 'https://wa.me/6285694488510');
    assert.equal(url.searchParams.get('text'), `Selamat ${greeting}, Admin OKESIH. Saya owner dari Kopi & Roti. Mohon bantuan terkait layanan OKESIH. Terima kasih.`);
  });
}
test('UTC time is converted to WITA and empty business name has a usable message', () => {
  const contact = ownerWhatsAppContact('  ', new Date('2026-10-24T01:00:00Z'));
  assert.equal(contact.isWorkingHours, true);
  assert.match(new URL(contact.url).searchParams.get('text'), /Selamat pagi, Admin OKESIH\. Saya pengguna dashboard Owner OKESIH\./);
});
