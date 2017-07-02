import React, { PureComponent } from 'react';
import { Modal, Platform, Text, TextInput, TouchableOpacity, View, } from 'react-native';
import AdvancedWebView from 'react-native-advanced-webview';
import { actions, messages } from './const';
import { EditorStyles as styles } from './styles';
import { InjectedMessageHandler } from './WebviewMessageHandler';
// Helpers
const injectScript = `
  (function () {
    ${InjectedMessageHandler}
  }());
`;
const PlatformIOS = Platform.OS === 'ios';
const upperCaseButtonTextIfNeeded = (buttonText) => PlatformIOS ? buttonText : buttonText.toUpperCase();
// Component
export default class RichTextEditor extends PureComponent {
    constructor(props) {
        super(props);
        this.captureWebviewRef = (c) => (this.webviewBridge = c);
        this.onBridgeMessage = (incomingMessage) => {
            const { data } = incomingMessage.nativeEvent;
            const { customCSS, contentPlaceholder, editorInitializedCallback, enableOnChange, hiddenTitle, initialContentHTML, initialTitleHTML, titlePlaceholder, } = this.props;
            const { onChange, selectionChangeListeners } = this.state;
            try {
                const message = JSON.parse(data);
                switch (message.type) {
                    case messages.TITLE_HTML_RESPONSE:
                        if (this.titleResolve) {
                            this.titleResolve(message.data);
                            this.titleResolve = undefined;
                            this.titleReject = undefined;
                            if (this.pendingTitleHtml) {
                                clearTimeout(this.pendingTitleHtml);
                                this.pendingTitleHtml = undefined;
                            }
                        }
                        break;
                    case messages.TITLE_TEXT_RESPONSE:
                        if (this.titleTextResolve) {
                            this.titleTextResolve(message.data);
                            this.titleTextResolve = undefined;
                            this.titleTextReject = undefined;
                            if (this.pendingTitleText) {
                                clearTimeout(this.pendingTitleText);
                                this.pendingTitleText = undefined;
                            }
                        }
                        break;
                    case messages.CONTENT_HTML_RESPONSE:
                        if (this.contentResolve) {
                            this.contentResolve(message.data);
                            this.contentResolve = undefined;
                            this.contentReject = undefined;
                            if (this.pendingContentHtml) {
                                clearTimeout(this.pendingContentHtml);
                                this.pendingContentHtml = undefined;
                            }
                        }
                        break;
                    case messages.SELECTED_TEXT_RESPONSE:
                        if (this.selectedTextResolve) {
                            this.selectedTextResolve(message.data);
                            this.selectedTextResolve = undefined;
                            this.selectedTextReject = undefined;
                            if (this.pendingSelectedText) {
                                clearTimeout(this.pendingSelectedText);
                                this.pendingSelectedText = undefined;
                            }
                        }
                        break;
                    case messages.ZSS_INITIALIZED:
                        if (customCSS) {
                            this.setCustomCSS(customCSS);
                        }
                        if (contentPlaceholder) {
                            this.setContentPlaceholder(contentPlaceholder);
                        }
                        if (initialContentHTML) {
                            this.setContentHTML(initialContentHTML);
                        }
                        if (!hiddenTitle) {
                            if (titlePlaceholder) {
                                this.setTitlePlaceholder(titlePlaceholder);
                            }
                            if (initialTitleHTML) {
                                this.setTitleHTML(initialTitleHTML);
                            }
                        }
                        else {
                            this.hideTitle();
                        }
                        if (enableOnChange) {
                            this.enableOnChange();
                        }
                        if (editorInitializedCallback) {
                            editorInitializedCallback();
                        }
                        break;
                    case messages.LINK_TOUCHED:
                        const { title, url } = message.data;
                        this.prepareInsert();
                        this.showLinkDialog(title, url);
                        break;
                    case messages.TITLE_FOCUSED:
                        if (this.titleFocusHandler) {
                            this.titleFocusHandler();
                        }
                        break;
                    case messages.CONTENT_FOCUSED:
                        if (this.contentFocusHandler) {
                            this.contentFocusHandler();
                        }
                        break;
                    case messages.SELECTION_CHANGE: {
                        const items = message.data.items;
                        selectionChangeListeners.map(listener => {
                            listener(items);
                        });
                        break;
                    }
                    case messages.CONTENT_CHANGE: {
                        const content = message.data.content;
                        onChange.map(listener => listener(content));
                        break;
                    }
                    case messages.SELECTED_TEXT_CHANGED: {
                        const selectedText = message.data;
                        this._selectedTextChangeListeners.forEach(listener => {
                            listener(selectedText);
                        });
                        break;
                    }
                    default: {
                        return;
                    }
                }
            }
            catch (e) {
                //alert('NON JSON MESSAGE');
            }
        };
        this.handleCloseLinkDialog = () => this.setState({ showLinkDialog: false });
        this.handleSetLinkTitle = (linkTitle) => this.setState({ linkTitle });
        this.handleSetLinkUrl = (linkUrl) => this.setState({ linkUrl });
        this.renderLinkModal = () => {
            const { keyboardHeight, linkTitle, linkUrl, showLinkDialog } = this.state;
            const modalButtons = this.renderModalButtons();
            return (React.createElement(Modal, { animationType: "fade", onRequestClose: this.handleCloseLinkDialog, transparent: true, visible: showLinkDialog },
                React.createElement(View, { style: styles.modal },
                    React.createElement(View, { style: [
                            styles.innerModal,
                            { marginBottom: PlatformIOS ? keyboardHeight : 0 },
                        ] },
                        React.createElement(Text, { style: styles.inputTitle }, "Title"),
                        React.createElement(View, { style: styles.inputWrapper },
                            React.createElement(TextInput, { style: styles.input, onChangeText: this.handleSetLinkTitle, value: linkTitle })),
                        React.createElement(Text, { style: [styles.inputURL] }, "URL"),
                        React.createElement(View, { style: styles.inputWrapper },
                            React.createElement(TextInput, { autoCapitalize: "none", autoCorrect: false, keyboardType: "url", onChangeText: this.handleSetLinkUrl, style: styles.input, value: linkUrl })),
                        PlatformIOS ? React.createElement(View, { style: styles.lineSeparator }) : null,
                        modalButtons))));
        };
        this.handleInsertLink = () => {
            const { linkUrl, linkTitle } = this.state;
            this.linkIsNew()
                ? this.insertLink(linkUrl, linkTitle)
                : this.updateLink(linkUrl, linkTitle);
            return this.hideModal();
        };
        this.hideModal = () => this.setState({
            showLinkDialog: false,
            linkInitialUrl: '',
            linkTitle: '',
            linkUrl: '',
        });
        this.linkIsNew = () => !this.state.linkInitialUrl;
        this.renderModalButtons = () => {
            const { linkTitle, linkUrl } = this.state;
            const insertUpdateDisabled = linkTitle.trim().length <= 0 || linkUrl.trim().length <= 0;
            return (React.createElement(View, { style: styles.containerPlatformStyle },
                !PlatformIOS && React.createElement(View, { style: { flex: 1 } }),
                React.createElement(TouchableOpacity, { onPress: this.hideModal, style: styles.buttonPlatformStyle },
                    React.createElement(Text, { style: [styles.button, { paddingRight: 10 }] }, upperCaseButtonTextIfNeeded('Cancel'))),
                React.createElement(TouchableOpacity, { onPress: this.handleInsertLink, disabled: insertUpdateDisabled, style: styles.buttonPlatformStyle },
                    React.createElement(Text, { style: [styles.button, { opacity: insertUpdateDisabled ? 0.5 : 1 }] }, upperCaseButtonTextIfNeeded(this.linkIsNew() ? 'Insert' : 'Update')))));
        };
        this.sendAction = (action, data) => this.webviewBridge.postMessage(JSON.stringify({ type: action, data }));
        //-------------------------------------------------------------------------------
        // Public API
        //-------------------------------------------------------------------------------
        // Event Listeners
        this.addSelectedTextChangeListener = (listener) => this._selectedTextChangeListeners.push(listener);
        this.registerToolbar = (listener) => this.setState({
            selectionChangeListeners: [
                ...this.state.selectionChangeListeners,
                listener,
            ],
        });
        this.registerContentChangeListener = (listener) => this.setState({
            onChange: [...this.state.onChange, listener],
        });
        // Webview Message Handlers
        this.alignCenter = () => this.sendAction(actions.alignCenter);
        this.alignFull = () => this.sendAction(actions.alignFull);
        this.alignLeft = () => this.sendAction(actions.alignLeft);
        this.alignRight = () => this.sendAction(actions.alignRight);
        this.blurContentEditor = () => this.sendAction(actions.blurContentEditor);
        this.blurTitleEditor = () => this.sendAction(actions.blurTitleEditor);
        this.enableOnChange = () => this.sendAction(actions.enableOnChange);
        this.focusTitle = () => this.sendAction(actions.focusTitle);
        this.focusContent = () => this.sendAction(actions.focusContent);
        this.heading1 = () => this.sendAction(actions.heading1);
        this.heading2 = () => this.sendAction(actions.heading2);
        this.heading3 = () => this.sendAction(actions.heading3);
        this.heading4 = () => this.sendAction(actions.heading4);
        this.heading5 = () => this.sendAction(actions.heading5);
        this.heading6 = () => this.sendAction(actions.heading6);
        this.hideTitle = () => this.sendAction(actions.hideTitle);
        this.init = () => {
            this.sendAction(actions.init);
            this.setPlatform();
            if (this.props.footerHeight) {
                this.setFooterHeight();
            }
        };
        this.insertBulletsList = () => this.sendAction(actions.insertBulletsList);
        this.insertImage = (attributes) => {
            this.sendAction(actions.insertImage, attributes);
            this.prepareInsert(); //This must be called BEFORE insertImage. But WebViewBridge uses a stack :/
        };
        this.insertLink = (url, title) => this.sendAction(actions.insertLink, { url, title });
        this.insertOrderedList = () => this.sendAction(actions.insertOrderedList);
        this.prepareInsert = () => this.sendAction(actions.prepareInsert);
        this.removeFormat = () => this.sendAction(actions.removeFormat);
        this.restoreSelection = () => this.sendAction(actions.restoreSelection);
        this.setBackgroundColor = (color) => this.sendAction(actions.setBackgroundColor, color);
        this.setTextColor = (color) => this.sendAction(actions.setTextColor, color);
        this.setTitlePlaceholder = (placeholder) => this.sendAction(actions.setTitlePlaceholder, placeholder);
        this.setContentPlaceholder = (placeholder) => this.sendAction(actions.setContentPlaceholder, placeholder);
        this.setCustomCSS = (css) => this.sendAction(actions.setCustomCSS, css);
        this.setBold = () => this.sendAction(actions.setBold);
        this.setContentFocusHandler = (callbackHandler) => {
            this.contentFocusHandler = callbackHandler;
            return this.sendAction(actions.setContentFocusHandler);
        };
        this.setContentHTML = (html) => this.sendAction(actions.setContentHtml, html);
        this.setEditorHeight = (height) => this.sendAction(actions.setEditorHeight, height);
        this.setFooterHeight = () => this.sendAction(actions.setFooterHeight, this.props.footerHeight);
        this.setPlatform = () => this.sendAction(actions.setPlatform, Platform.OS);
        this.setHR = () => this.sendAction(actions.setHR);
        this.setIndent = () => this.sendAction(actions.setIndent);
        this.setItalic = () => this.sendAction(actions.setItalic);
        this.setOutdent = () => this.sendAction(actions.setOutdent);
        this.setParagraph = () => this.sendAction(actions.setParagraph);
        this.setStrikethrough = () => this.sendAction(actions.setStrikethrough);
        this.setSubscript = () => this.sendAction(actions.setSubscript);
        this.setSuperscript = () => this.sendAction(actions.setSuperscript);
        this.setTitleFocusHandler = (callbackHandler) => {
            this.titleFocusHandler = callbackHandler;
            return this.sendAction(actions.setTitleFocusHandler);
        };
        this.setTitleHTML = (html) => this.sendAction(actions.setTitleHtml, html);
        this.setUnderline = () => this.sendAction(actions.setUnderline);
        this.showTitle = () => this.sendAction(actions.showTitle);
        this.toggleTitle = () => this.sendAction(actions.toggleTitle);
        this.updateLink = (url, title) => this.sendAction(actions.updateLink, { url, title });
        // Async Actions
        this.getContentHtml = () => new Promise((resolve, reject) => {
            this.contentResolve = resolve;
            this.contentReject = reject;
            this.sendAction(actions.getContentHtml);
            this.pendingContentHtml = setTimeout(() => {
                if (this.contentReject) {
                    this.contentReject('timeout');
                }
            }, 5000);
        });
        this.getSelectedText = () => new Promise((resolve, reject) => {
            this.selectedTextResolve = resolve;
            this.selectedTextReject = reject;
            this.sendAction(actions.getSelectedText);
            this.pendingSelectedText = setTimeout(() => {
                if (this.selectedTextReject) {
                    this.selectedTextReject('timeout');
                }
            }, 5000);
        });
        this.getTitleHtml = () => new Promise((resolve, reject) => {
            this.titleResolve = resolve;
            this.titleReject = reject;
            this.sendAction(actions.getTitleHtml);
            this.pendingTitleHtml = setTimeout(() => {
                if (this.titleReject) {
                    this.titleReject('timeout');
                }
            }, 5000);
        });
        this.getTitleText = () => new Promise((resolve, reject) => {
            this.titleTextResolve = resolve;
            this.titleTextReject = reject;
            this.sendAction(actions.getTitleText);
            this.pendingTitleText = setTimeout(() => {
                if (this.titleTextReject) {
                    this.titleTextReject('timeout');
                }
            }, 5000);
        });
        // Misc
        this.showLinkDialog = (optionalTitle = '', optionalUrl = '') => this.setState({
            linkInitialUrl: optionalUrl,
            linkTitle: optionalTitle,
            linkUrl: optionalUrl,
            showLinkDialog: true,
        });
        this.state = {
            keyboardHeight: 0,
            linkInitialUrl: '',
            linkTitle: '',
            linkUrl: '',
            onChange: [],
            selectionChangeListeners: [],
            showLinkDialog: false,
        };
    }
    render() {
        //in release build, external html files in Android can't be required, so they must be placed in the assets folder and accessed via uri
        const pageSource = PlatformIOS
            ? require('./editor.html')
            : { uri: 'file:///android_asset/editor.html' };
        const linkModal = this.renderLinkModal();
        return (React.createElement(View, { style: styles.editorContainer },
            React.createElement(AdvancedWebView, Object.assign({ hideAccessory: true, injectedJavaScript: injectScript, javaScriptEnabled: true, onLoad: this.init, onMessage: this.onBridgeMessage, ref: this.captureWebviewRef, source: pageSource, style: styles.editor }, this.props)),
            linkModal));
    }
}
//# sourceMappingURL=RichTextEditor.js.map