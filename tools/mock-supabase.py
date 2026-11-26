#!/usr/bin/env python3
"""Servidor simulado de Supabase (Auth + REST) para probar Azulejo en local.

Uso:
  python3 tools/mock-supabase.py 54321
  y en la consola del navegador (en localhost):
  localStorage['azulejo.cloud.dev'] = JSON.stringify({url: 'http://localhost:54321', key: 'dev'})

Implementa solo lo que usa js/cloud.js. Los datos viven en memoria.
Con --confirm el registro exige confirmar el correo (no devuelve sesión).
"""
import json
import sys
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

USERS = {}      # email -> {id, email, password, name}
TOKENS = {}     # access_token -> user id
REFRESH = {}    # refresh_token -> user id
SAVES = {}      # user id -> {state, updated_at}
PLAYERS = {}    # user id -> row
CONFIRM = '--confirm' in sys.argv
EXPIRES = 3600


def session_for(u):
    access, refresh = 'at_' + uuid.uuid4().hex, 'rt_' + uuid.uuid4().hex
    TOKENS[access] = u['id']
    REFRESH[refresh] = u['id']
    return {
        'access_token': access, 'token_type': 'bearer', 'expires_in': EXPIRES,
        'expires_at': int(time.time()) + EXPIRES, 'refresh_token': refresh,
        'user': {'id': u['id'], 'email': u['email']},
    }


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'apikey, authorization, content-type, prefer, x-client-info')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, HEAD, OPTIONS')
        self.send_header('Access-Control-Expose-Headers', 'Content-Range')

    def reply(self, code, data=None, headers=None):
        body = b'' if data is None else json.dumps(data).encode()
        self.send_response(code)
        self.cors()
        self.send_header('Content-Type', 'application/json')
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)

    def body(self):
        n = int(self.headers.get('Content-Length') or 0)
        return json.loads(self.rfile.read(n) or b'{}') if n else {}

    def uid(self):
        auth = self.headers.get('Authorization', '')
        return TOKENS.get(auth.replace('Bearer ', '')) if auth.startswith('Bearer ') else None

    def do_OPTIONS(self):
        self.send_response(204)
        self.cors()
        self.end_headers()

    def do_HEAD(self):
        self.route()

    def do_GET(self):
        self.route()

    def do_POST(self):
        self.route()

    def do_PUT(self):
        self.route()

    def route(self):
        if self.headers.get('apikey') != 'dev':
            return self.reply(401, {'message': 'Invalid API key'})
        u = urlparse(self.path)
        q = parse_qs(u.query)
        p, m = u.path, self.command
        if p == '/auth/v1/signup' and m == 'POST':
            b = self.body()
            email = b.get('email', '').lower()
            if len(b.get('password', '')) < 6:
                return self.reply(422, {'code': 422, 'error_code': 'weak_password', 'msg': 'Password should be at least 6 characters.'})
            if email in USERS:
                return self.reply(422, {'code': 422, 'error_code': 'user_already_exists', 'msg': 'User already registered'})
            user = {'id': str(uuid.uuid4()), 'email': email, 'password': b['password'], 'name': b.get('data', {}).get('display_name')}
            USERS[email] = user
            if CONFIRM:
                return self.reply(200, {'id': user['id'], 'email': email, 'identities': [{'id': 'x'}], 'confirmation_sent_at': 'now'})
            return self.reply(200, session_for(user))
        if p == '/auth/v1/token' and m == 'POST':
            b = self.body()
            grant = q.get('grant_type', [''])[0]
            if grant == 'password':
                user = USERS.get(b.get('email', '').lower())
                if not user or user['password'] != b.get('password'):
                    return self.reply(400, {'code': 400, 'error_code': 'invalid_credentials', 'msg': 'Invalid login credentials'})
                return self.reply(200, session_for(user))
            if grant == 'refresh_token':
                uid = REFRESH.pop(b.get('refresh_token'), None)
                user = next((x for x in USERS.values() if x['id'] == uid), None)
                if not user:
                    return self.reply(400, {'code': 400, 'error_code': 'refresh_token_not_found', 'msg': 'Invalid Refresh Token'})
                return self.reply(200, session_for(user))
        if p == '/auth/v1/logout' and m == 'POST':
            return self.reply(204)
        if p == '/auth/v1/recover' and m == 'POST':
            return self.reply(200, {})
        if p == '/auth/v1/user':
            uid = self.uid()
            user = next((x for x in USERS.values() if x['id'] == uid), None)
            if not user:
                return self.reply(401, {'code': 401, 'msg': 'invalid JWT'})
            if m == 'PUT':
                user['password'] = self.body().get('password', user['password'])
            return self.reply(200, {'id': user['id'], 'email': user['email']})
        if p == '/rest/v1/saves':
            uid = self.uid()
            if not uid:
                return self.reply(401, {'message': 'JWT required'})
            if m == 'GET':
                want = q.get('user_id', ['eq.'])[0][3:]
                row = SAVES.get(want) if want == uid else None
                return self.reply(200, [row] if row else [])
            if m == 'POST':
                b = self.body()
                if b.get('user_id') != uid:
                    return self.reply(403, {'message': 'new row violates row-level security policy'})
                SAVES[uid] = {'state': b['state'], 'updated_at': b.get('updated_at')}
                return self.reply(201)
        if p == '/rest/v1/players':
            if m == 'POST':
                uid = self.uid()
                b = self.body()
                if not uid or b.get('user_id') != uid:
                    return self.reply(403, {'message': 'new row violates row-level security policy'})
                PLAYERS[uid] = {k: b.get(k) for k in ('user_id', 'display_name', 'avatar', 'points', 'levels_done', 'updated_at')}
                return self.reply(201)
            rows = sorted(PLAYERS.values(), key=lambda r: (-r['points'], r['updated_at'] or ''))
            if 'points' in q:
                n = int(q['points'][0][3:])
                count = sum(1 for r in rows if r['points'] > n)
                return self.reply(200, [], {'Content-Range': f'*/{count}'})
            limit = int(q.get('limit', ['50'])[0])
            return self.reply(200, rows[:limit])
        return self.reply(404, {'message': f'no route {m} {p}'})


if __name__ == '__main__':
    port = int(next((a for a in sys.argv[1:] if a.isdigit()), '54321'))
    print(f'Supabase simulado en http://localhost:{port}' + (' (confirmación de correo activada)' if CONFIRM else ''))
    ThreadingHTTPServer(('127.0.0.1', port), H).serve_forever()
