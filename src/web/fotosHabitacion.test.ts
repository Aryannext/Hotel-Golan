import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { eliminarFotoHabitacion, FOTO_DEFECTO, guardarFotoHabitacion, MAX_BYTES_FOTO, obtenerFotoHabitacion, procesarArchivoFoto, validarArchivoFoto } from './fotosHabitacion.ts';
const originales = Object.getOwnPropertyDescriptors(globalThis);
afterEach(() => { for (const nombre of ['localStorage','window','CustomEvent']) { if (originales[nombre]) Object.defineProperty(globalThis,nombre,originales[nombre]); else Reflect.deleteProperty(globalThis,nombre); } });
describe('Fotos locales de habitaciones', () => {
  it('rechaza tipos no admitidos, vacíos y más de 5 MB', () => {
    assert.match(validarArchivoFoto({type:'image/svg+xml',size:50})!,/JPG/);
    assert.match(validarArchivoFoto({type:'image/jpeg',size:0})!,/vacía/);
    assert.match(validarArchivoFoto({type:'image/jpeg',size:MAX_BYTES_FOTO+1})!,/5 MB/);
    assert.equal(validarArchivoFoto({type:'image/png',size:MAX_BYTES_FOTO}),null);
  });
  it('rechaza un archivo inválido antes de intentar decodificarlo', async () => {
    await assert.rejects(procesarArchivoFoto({type:'text/plain',size:200} as File),/JPG/);
  });
  it('un almacenamiento lleno devuelve un error visible y no anuncia éxito', () => {
    Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{setItem(){throw Error('QuotaExceeded')}}});
    assert.throws(() => guardarFotoHabitacion('201','data:image/jpeg;base64,abc'),/lleno o bloqueado/);
  });
  it('elimina solo la habitación elegida y propaga la vista previa por defecto', () => {
    const datos=new Map([['hotel_golan_foto_hab_201','foto201'],['hotel_golan_foto_hab_202','foto202']]);
    Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>datos.get(k),removeItem:(k:string)=>datos.delete(k)}});
    const eventos:unknown[]=[];
    Object.defineProperty(globalThis,'window',{configurable:true,value:{dispatchEvent:(ev:unknown)=>eventos.push(ev)}});
    Object.defineProperty(globalThis,'CustomEvent',{configurable:true,value:class {type:string;detail:unknown;constructor(type:string,o:{detail:unknown}){this.type=type;this.detail=o.detail;}}});
    eliminarFotoHabitacion('201');
    assert.equal(obtenerFotoHabitacion('201'),FOTO_DEFECTO);assert.equal(obtenerFotoHabitacion('202'),'foto202');
    assert.equal(eventos.length,1);
    assert.deepEqual((eventos[0] as {detail:unknown}).detail,{numero:'201',dataUrl:FOTO_DEFECTO});
  });
});
