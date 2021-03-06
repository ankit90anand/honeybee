import { batchActions } from 'redux-batched-actions';
import * as actionCreators from "../actionCreators.js";
const timeout_processConnQ = 1000;

export default class MeshPeer {
    static propTypes = {
        peerConfig: Object,
        dispatch: Function,
        players: Object
    }
    constructor(props) {
        this.props = props;
        this.peer = new Peer(this.props.peerConfig);
        this.peer.on("open", this.onOpen.bind(this));
        this.peer.on("error", this.onError.bind(this));
        this.connQ = [];
        this.timer_processConnQ = 0;
    }
    connect(destPeerIds = []) { //{A}A{R,A}//{B}B{R,B}//{R,B}B{R,A,B}
        //String or array of string
        destPeerIds = [].concat(destPeerIds);

        this.props.dispatch(batchActions(actionCreators.peerConnect(destPeerIds)));

        let connectOptions = {
            metaData: {
                playerIds: Object.keys(this.props.players).concat(destPeerIds)
            }
        };
        destPeerIds.forEach((destPeerId) => {
            //Refer Peer js API        
            this.peer.connect(destPeerId, connectOptions);
        });

        
    }
    onError() {
        console.warn(...arguments);
    }
    onOpen(peerId) { //{R}R
        this.peer.on("connection", this.onConnection.bind(this));
        this.peer.on("data", this.onData.bind(this));
        this.props.dispatch(actionCreators.peerOnOpen(peerId));
    }
    onConnection(conn) { //{R}R{R,A}//{R,A}R{R,A,B}//{R,A}A{R,A,B}
        this.props.dispatch(actionCreators.addPlayer(conn.peerId));
        this.connQ.push(conn);
    }
    onData(data) {
        switch (data.type) {
            case "CONNECT_TO":
                this.connectTo(data.payload.playerIds)
                break;
            default:
                return true
        }
    }
    processConnQ(nextProps) {
        //Process conn queue in debounced fashion
        clearTimeout(this.timer_processConnQ);
        this.timer_processConnQ = setTimeout(() => {
            this.connQ.forEach((conn) => {
                let missingPlayerIds = Object.keys(nextProps.players).filter(playerId => (conn.metaData.playerIds.indexOf(playerId) == -1))
                if (missingPlayerIds.length) {
                    conn.send({
                        type: "CONNECT_TO",
                        payload: {
                            playerIds: missingPlayerIds //{A}
                        }
                    });
                }
            });
            this.connQ = [];
        }, timeout_processConnQ);
    }
    onStoreUpdate(nextProps) {
        if (nextProps.players != this.props.players) {
            this.processConnQ(nextProps);
            this.props.players = nextProps.players;
        }
    }
}
