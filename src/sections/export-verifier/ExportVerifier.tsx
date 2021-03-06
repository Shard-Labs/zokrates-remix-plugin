import { saveAs } from "file-saver";
import React, { useEffect, useReducer } from "react";
import {
  Button,
  ButtonGroup,
  Col,
  Form,
  OverlayTrigger,
  Row,
  Tooltip,
} from "react-bootstrap";
import { Alert, LoadingButton } from "../../components";
import { remixClient } from "../../remix/RemixClient";
import { setExportVerifierResult } from "../../state/actions";
import { useDispatchContext, useStateContext } from "../../state/Store";
import { onCleanup, onError, onLoading, onSuccess, updateAbi } from "./actions";
import { exportVerifierReducer, IExportVerifierState } from "./reducer";
import { WA_EXPORT_VERIFIER, WA_ERROR } from "../../zokrates/constants";

export const ExportVerifier: React.FC = () => {
  const initialState: IExportVerifierState = {
    isLoading: false,
    abiv2: false,
    result: null,
    error: "",
  };

  const stateContext = useStateContext();
  const dispatchContext = useDispatchContext();
  const [state, dispatch] = useReducer(exportVerifierReducer, initialState);

  const { zokratesWebWorker } = stateContext;

  const onWorkerMessage = (e: MessageEvent) => {
    switch (e.data.type) {
      case WA_EXPORT_VERIFIER: {
        const { verifier, abiVersion } = e.data.payload;
        dispatch(onSuccess(verifier));
        dispatchContext(setExportVerifierResult({ verifier, abiVersion }));
        break;
      }
      case WA_ERROR: {
        dispatch(onError(e.data.payload));
        break;
      }
      default:
        break;
    }
  };

  useEffect(() => {
    const subscription = zokratesWebWorker
      .onMessage()
      .subscribe(onWorkerMessage);
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    dispatch(onCleanup());
    dispatchContext(setExportVerifierResult(null));
  }, [stateContext.setupResult]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    dispatch(onLoading());

    setTimeout(() => {
      try {
        zokratesWebWorker.postMessage(WA_EXPORT_VERIFIER, {
          vk: stateContext.setupResult.vk,
          abiVersion: state.abiv2 ? "v2" : "v1",
        });
      } catch (error) {
        dispatch(onError(error.toString()));
      }
    }, 200);
  };

  const openInRemix = () => {
    remixClient.createFile("browser/verifier.sol", state.result);
  };

  const onDownload = () => {
    let blob = new Blob([state.result], { type: "text/plain;charset=utf-8" });
    saveAs(blob, "verifier.sol");
  };

  return (
    <>
      <Row>
        <Col>
          <p>
            Generates a Solidity contract which contains the generated
            verification key and a public function to verify a solution to the
            compiled program.
          </p>
          <Form onSubmit={onSubmit}>
            <Form.Group controlId="abi">
              <Form.Check
                type="checkbox"
                label="Use ABI v2"
                name="abiv2"
                checked={state.abiv2}
                onChange={(event: any) => {
                  dispatch(updateAbi(event.currentTarget.checked));
                }}
              />
            </Form.Group>
            <div className="d-flex justify-content-between">
              <LoadingButton
                type="submit"
                disabled={!stateContext.setupResult || state.isLoading}
                defaultText="Export"
                loadingText="Exporting..."
                iconClassName="fa fa-key"
                isLoading={state.isLoading}
              />
              <ButtonGroup>
                <OverlayTrigger
                  placement="top"
                  overlay={
                    <Tooltip id="tooltip-remix-verifier">
                      Open in Remix Editor
                    </Tooltip>
                  }
                >
                  <Button
                    disabled={!state.result}
                    variant="light"
                    onClick={openInRemix}
                  >
                    <i className="fa fa-share" aria-hidden="true"></i>
                  </Button>
                </OverlayTrigger>
                <OverlayTrigger
                  placement="top"
                  overlay={
                    <Tooltip id="tooltip-download-verifier">Download</Tooltip>
                  }
                >
                  <Button
                    disabled={!state.result}
                    variant="light"
                    onClick={onDownload}
                  >
                    <i className="fa fa-download" aria-hidden="true"></i>
                  </Button>
                </OverlayTrigger>
              </ButtonGroup>
            </div>
          </Form>
        </Col>
      </Row>
      {state.error && (
        <Alert variant="danger" iconClass="fa fa-exclamation-circle">
          <pre>
            <code>{state.error}</code>
          </pre>
        </Alert>
      )}
      {state.result && (
        <Alert variant="success" iconClass="fa fa-check">
          Solidity verifier generated!
        </Alert>
      )}
    </>
  );
};
