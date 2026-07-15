@echo off
node -e "const a=require('firebase-admin');const m=require('firebase-admin/firestore');console.log('ns.FieldValue',typeof a.firestore.FieldValue,'|','modular.FieldValue',typeof m.FieldValue,'|','modular.Timestamp',typeof m.Timestamp)"

