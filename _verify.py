import json
import threading
import urllib.request
import socketserver
import http.server


def main():
    for name in ['config', 'qa', 'rules', 'sources', 'checklists']:
        with open('data/%s.json' % name, encoding='utf-8') as fh:
            json.load(fh)
        print('%s.json OK' % name)

    httpd = socketserver.TCPServer(('127.0.0.1', 8791), http.server.SimpleHTTPRequestHandler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    try:
        for path in ['/', '/data/qa.json', '/data/rules.json', '/data/checklists.json', '/css/style.css', '/js/app.js']:
            res = urllib.request.urlopen('http://127.0.0.1:8791' + path)
            print('HTTP %-24s %s %d bytes' % (path, res.status, len(res.read())))
    finally:
        httpd.shutdown()


if __name__ == '__main__':
    main()