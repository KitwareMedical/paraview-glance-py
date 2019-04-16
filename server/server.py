import sys
import os
import webbrowser
import socket

from wslink.websocket import ServerProtocol
from wslink import server
from twisted.internet import reactor

from protocol import Protocol

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
        self.registerLinkProtocol(Protocol())
        self.updateSecret(AlgorithmServer.authKey)

if __name__ == '__main__':
    # https://stackoverflow.com/questions/7674790/bundling-data-files-with-pyinstaller-onefile
    try:
        basepath = sys._MEIPASS
    except:
        basepath = os.path.dirname(os.path.dirname(sys.argv[0]))

    static_dir = os.path.join(basepath, 'www')
    host = 'localhost'
    port = get_port()
    args = [
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

    #threading.Timer(1, target=open_webapp).start()
    reactor.callWhenRunning(open_webapp)

    server.start(args, AlgorithmServer)
    server.stop_webserver()
