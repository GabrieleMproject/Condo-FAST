#!/bin/bash
BASE64_PDF="JVBERi0xLjcKCjEgMCBvYmogICUgZW50cnkgcG9pbnQKPDwKICAvVHlwZSAvQ2F0YWxvZwogIC9QYWdlcyAyIDAgUgo+PgplbmRvYmoKCjIgMCBvYmoKPDwKICAvVHlwZSAvUGFnZXMKICAvTWVkaWFCb3ggWyAwIDAgMjAwIDIwMCBdCiAgL0NvdW50IDEKICAvS2lkcyBbIDMgMCBSIF0KPj4KZW5kb2JqCgozIDAgb2JqCjw8CiAgL1R5cGUgL1BhZ2UKICAvUGFyZW50IDIgMCBSCiAgL1Jlc291cmNlcyA8PAogICAgL0ZvbnQgPDwKICAgICAgL0YxIDQgMCBSCgkgID4+CgkgID4+CiAgL0NvbnRlbnRzIDUgMCBSCj4+CmVuZG9iagoKNCAwIG9iago8PAogIC9UeXBlIC9Gb250CiAgL1N1YnR5cGUgL1R5cGUxCiAgL0Jhc2VGb250IC9UaW1lcy1Sb21hbgo+PgplbmRvYmoKCjUgMCBvYmoKPDwgL0xlbmd0aCAyNCA+PgpzdHJlYW0KQlQKL0YxIDE4IFRmCjAgMCAwIHJnCjEwIDEwMCBUZAooSGVsbG8gV29ybGQpIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAxMCAwMDAwMCBuIAowMDAwMDAwMDY4IDAwMDAwIG4gCjAwMDAwMDAxNjcgMDAwMDAgbiAKMDAwMDAwMDI4NyAwMDAwMCBuIAowMDAwMDAwMzc0IDAwMDAwIG4gCnRyYWlsZXIKPDwKICAvU2l6ZSA2CiAgL1Jvb3QgMSAwIFIKPj4Kc3RhcnR4cmVmCjQ3MAolJUVPRgo="

curl -v -X POST \
  -H "Content-Type: application/json" \
  -H "X-CondoFAST-Demo: true" \
  -d '{
    "type": "document",
    "mediaType": "application/pdf",
    "prompt": "Estrai i dati.",
    "jsonMode": true,
    "jsonSchema": {
      "type": "OBJECT",
      "properties": {
        "dati": {
          "type": "OBJECT",
          "properties": {
            "totale": { "type": "NUMBER" }
          }
        }
      }
    },
    "document": "'"$BASE64_PDF"'"
  }' \
  https://aapksiokakavarwaumwy.supabase.co/functions/v1/gemini-proxy
