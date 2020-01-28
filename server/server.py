import sys
import os
import webbrowser
import socket
import argparse

from wslink.websocket import ServerProtocol
from wslink import server
from twisted.internet import reactor

from hello_world import AlgorithmApi

def get_port():
    '''Don't care about race condition here for getting a free port.'''
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.bind(('localhost', 0))
    _, port = sock.getsockname()
    sock.close()
    return port

class AlgorithmServer(ServerProtocol):
    # TODO change this default secret
    authKey = 'wslink-secret'

    @staticmethod
    def configure(options):
        AlgorithmServer.authKey = options.authKey

    def initialize(self):
        self.registerLinkProtocol(AlgorithmApi())
        self.updateSecret(AlgorithmServer.authKey)

if __name__ == '__main__':
    # https://stackoverflow.com/questions/7674790/bundling-data-files-with-pyinstaller-onefile
    try:
        basepath = sys._MEIPASS
    except:
        basepath = os.path.dirname(os.path.dirname(sys.argv[0]))

    parser = argparse.ArgumentParser()
    parser.add_argument('-H', '--host', default='localhost',
                        help='Hostname for server to listen on')
    parser.add_argument('-P', '--port', default=get_port(),
                        help='Port for server to listen on')
    parser.add_argument('-b', '--no-browser', action='store_true',
                        help='Do not auto-open the browser')
    args = parser.parse_args()
    print(args)

    static_dir = os.path.join(basepath, 'www')
    host = args.host
    port = args.port
    server_args = [
        '--content', static_dir,
        '--host', host,
        '--port', str(port)
    ]

    wsurl = 'ws://{host}:{port}/ws'.format(host=host, port=port)
    full_url = 'http://{host}:{port}/?wsServer={wsurl}'.format(
            host=host, port=port, wsurl=wsurl)

    print('If the browser doesn\'t open, navigate to:', full_url)

    def open_webapp():
        webbrowser.open(full_url)

    if not args.no_browser:
        reactor.callLater(0.1, open_webapp)

    server.start(server_args, AlgorithmServer)
    server.stop_webserver()
