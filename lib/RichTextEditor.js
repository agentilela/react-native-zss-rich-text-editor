import React, { PureComponent } from 'react';
import { Dimensions, Keyboard, Modal, PixelRatio, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View, } from 'react-native';
import WebViewBridge from 'react-native-webview-bridge-updated';
import { actions, messages } from './const';
import { InjectedMessageHandler } from './WebviewMessageHandler';
const injectScript = `
  (function () {
    ${InjectedMessageHandler}
  }());
`;
const PlatformIOS = Platform.OS === 'ios';
export default class RichTextEditor extends PureComponent {
    constructor(props) {
        super(props);
        this.captureWebviewRef = (c) => (this.webviewBridge = c);
        this.handleKeyboardWillShow = (event) => {
            const newKeyboardHeight = event.endCoordinates.height;
            if (this.state.keyboardHeight === newKeyboardHeight) {
                return;
            }
            if (newKeyboardHeight) {
                this.setEditorAvailableHeightBasedOnKeyboardHeight(newKeyboardHeight);
            }
            this.setState({ keyboardHeight: newKeyboardHeight });
        };
        this.handleKeyboardWillHide = (event) => this.setState({ keyboardHeight: 0 });
        this.setEditorAvailableHeightBasedOnKeyboardHeight = (keyboardHeight) => {
            const { contentInset, style } = this.props;
            let spacing = 0;
            if (contentInset) {
                const { top, bottom } = contentInset;
                spacing += (top || 0) + (bottom || 0);
            }
            if (style) {
                const { marginTop, marginBottom } = style;
                spacing += (marginTop || 0) + (marginBottom || 0);
            }
            const editorAvailableHeight = Dimensions.get('window').height - keyboardHeight - spacing;
            this.setEditorHeight(editorAvailableHeight);
        };
        this.handleCloseLinkDialog = () => this.setState({ showLinkDialog: false });
        this.handleSetLinkTitle = (linkTitle) => this.setState({ linkTitle });
        this.handleSetLinkUrl = (linkUrl) => this.setState({ linkUrl });
        this.handleInsertLink = () => {
            const { linkUrl, linkTitle } = this.state;
            this.linkIsNew()
                ? this.insertLink(linkUrl, linkTitle)
                : this.updateLink(linkUrl, linkTitle);
            return this.hideModal();
        };
        this.linkIsNew = () => !this.state.linkInitialUrl;
        this.upperCaseButtonTextIfNeeded = (buttonText) => PlatformIOS ? buttonText : buttonText.toUpperCase();
        this.escapeJSONString = (text) => text
            .replace(/[\\]/g, '\\\\')
            .replace(/[\"]/g, '\\"')
            .replace(/[\']/g, "\\'")
            .replace(/[\/]/g, '\\/')
            .replace(/[\b]/g, '\\b')
            .replace(/[\f]/g, '\\f')
            .replace(/[\n]/g, '\\n')
            .replace(/[\r]/g, '\\r')
            .replace(/[\t]/g, '\\t');
        this.sendAction = (action, data) => {
            const jsonString = JSON.stringify({ type: action, data });
            this.webviewBridge.sendToBridge(this.escapeJSONString(jsonString));
        };
        //-------------------------------------------------------------------------------
        //--------------- Public API
        this.showLinkDialog = (optionalTitle = '', optionalUrl = '') => this.setState({
            linkInitialUrl: optionalUrl,
            linkTitle: optionalTitle,
            linkUrl: optionalUrl,
            showLinkDialog: true,
        });
        this.focusTitle = () => this.sendAction(actions.focusTitle);
        this.focusContent = () => this.sendAction(actions.focusContent);
        this.registerToolbar = (listener) => this.setState({
            selectionChangeListeners: [
                ...this.state.selectionChangeListeners,
                listener,
            ],
        });
        this.enableOnChange = () => this.sendAction(actions.enableOnChange);
        this.registerContentChangeListener = (listener) => this.setState({
            onChange: [...this.state.onChange, listener],
        });
        this.setTitleHTML = (html) => this.sendAction(actions.setTitleHtml, html);
        this.hideTitle = () => this.sendAction(actions.hideTitle);
        this.showTitle = () => this.sendAction(actions.showTitle);
        this.toggleTitle = () => this.sendAction(actions.toggleTitle);
        this.setContentHTML = (html) => this.sendAction(actions.setContentHtml, html);
        this.blurTitleEditor = () => this.sendAction(actions.blurTitleEditor);
        this.blurContentEditor = () => this.sendAction(actions.blurContentEditor);
        this.setBold = () => this.sendAction(actions.setBold);
        this.setItalic = () => this.sendAction(actions.setItalic);
        this.setUnderline = () => this.sendAction(actions.setUnderline);
        this.heading1 = () => this.sendAction(actions.heading1);
        this.heading2 = () => this.sendAction(actions.heading2);
        this.heading3 = () => this.sendAction(actions.heading3);
        this.heading4 = () => this.sendAction(actions.heading4);
        this.heading5 = () => this.sendAction(actions.heading5);
        this.heading6 = () => this.sendAction(actions.heading6);
        this.setParagraph = () => this.sendAction(actions.setParagraph);
        this.removeFormat = () => this.sendAction(actions.removeFormat);
        this.alignLeft = () => this.sendAction(actions.alignLeft);
        this.alignCenter = () => this.sendAction(actions.alignCenter);
        this.alignRight = () => this.sendAction(actions.alignRight);
        this.alignFull = () => this.sendAction(actions.alignFull);
        this.insertBulletsList = () => this.sendAction(actions.insertBulletsList);
        this.insertOrderedList = () => this.sendAction(actions.insertOrderedList);
        this.insertLink = (url, title) => this.sendAction(actions.insertLink, { url, title });
        this.updateLink = (url, title) => this.sendAction(actions.updateLink, { url, title });
        this.insertImage = (attributes) => {
            this.sendAction(actions.insertImage, attributes);
            this.prepareInsert(); //This must be called BEFORE insertImage. But WebViewBridge uses a stack :/
        };
        this.setSubscript = () => this.sendAction(actions.setSubscript);
        this.setSuperscript = () => this.sendAction(actions.setSuperscript);
        this.setStrikethrough = () => this.sendAction(actions.setStrikethrough);
        this.setHR = () => this.sendAction(actions.setHR);
        this.setIndent = () => this.sendAction(actions.setIndent);
        this.setOutdent = () => this.sendAction(actions.setOutdent);
        this.setBackgroundColor = (color) => this.sendAction(actions.setBackgroundColor, color);
        this.setTextColor = (color) => this.sendAction(actions.setTextColor, color);
        this.setTitlePlaceholder = (placeholder) => this.sendAction(actions.setTitlePlaceholder, placeholder);
        this.setContentPlaceholder = (placeholder) => this.sendAction(actions.setContentPlaceholder, placeholder);
        this.setCustomCSS = (css) => this.sendAction(actions.setCustomCSS, css);
        this.prepareInsert = () => this.sendAction(actions.prepareInsert);
        this.restoreSelection = () => this.sendAction(actions.restoreSelection);
        this.init = () => {
            this.sendAction(actions.init);
            this.setPlatform();
            if (this.props.footerHeight) {
                this.setFooterHeight();
            }
        };
        this.setEditorHeight = (height) => this.sendAction(actions.setEditorHeight, height);
        this.setFooterHeight = () => this.sendAction(actions.setFooterHeight, this.props.footerHeight);
        this.setPlatform = () => this.sendAction(actions.setPlatform, Platform.OS);
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
        this.setTitleFocusHandler = (callbackHandler) => {
            this.titleFocusHandler = callbackHandler;
            return this.sendAction(actions.setTitleFocusHandler);
        };
        this.setContentFocusHandler = (callbackHandler) => {
            this.contentFocusHandler = callbackHandler;
            return this.sendAction(actions.setContentFocusHandler);
        };
        this.addSelectedTextChangeListener = (listener) => this._selectedTextChangeListeners.push(listener);
        this.state = {
            selectionChangeListeners: [],
            onChange: [],
            showLinkDialog: false,
            linkInitialUrl: '',
            linkTitle: '',
            linkUrl: '',
            keyboardHeight: 0,
        };
    }
    componentWillMount() {
        if (PlatformIOS) {
            this._keyboardEventListeners = [
                Keyboard.addListener('keyboardWillShow', this.handleKeyboardWillShow),
                Keyboard.addListener('keyboardWillHide', this.handleKeyboardWillHide),
            ];
        }
        else {
            this._keyboardEventListeners = [
                Keyboard.addListener('keyboardDidShow', this.handleKeyboardWillShow),
                Keyboard.addListener('keyboardDidHide', this.handleKeyboardWillHide),
            ];
        }
    }
    componentWillUnmount() {
        this._keyboardEventListeners.forEach(eventListener => eventListener.remove());
    }
    onBridgeMessage(str) {
        const { customCSS, contentPlaceholder, editorInitializedCallback, enableOnChange, hiddenTitle, initialContentHTML, initialTitleHTML, titlePlaceholder, } = this.props;
        try {
            const message = JSON.parse(str);
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
                    this.prepareInsert();
                    const { title, url } = message.data;
                    this.showLinkDialog(title, url);
                    break;
                case messages.SCROLL:
                    this.webviewBridge.setNativeProps({
                        contentOffset: { y: message.data },
                    });
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
                    this.state.selectionChangeListeners.map(listener => {
                        listener(items);
                    });
                    break;
                }
                case messages.CONTENT_CHANGE: {
                    const content = message.data.content;
                    this.state.onChange.map(listener => listener(content));
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
    }
    renderLinkModal() {
        const { keyboardHeight, linkTitle, linkUrl, showLinkDialog } = this.state;
        const modalButtons = this.renderModalButtons();
        return (React.createElement(Modal, { animationType: 'fade', onRequestClose: this.handleCloseLinkDialog, transparent: true, visible: showLinkDialog },
            React.createElement(View, { style: styles.modal },
                React.createElement(View, { style: [
                        styles.innerModal,
                        { marginBottom: PlatformIOS ? keyboardHeight : 0 },
                    ] },
                    React.createElement(Text, { style: styles.inputTitle }, "Title"),
                    React.createElement(View, { style: styles.inputWrapper },
                        React.createElement(TextInput, { style: styles.input, onChangeText: this.handleSetLinkTitle, value: linkTitle })),
                    React.createElement(Text, { style: [styles.inputTitle, { marginTop: 10 }] }, "URL"),
                    React.createElement(View, { style: styles.inputWrapper },
                        React.createElement(TextInput, { style: styles.input, onChangeText: this.handleSetLinkUrl, value: linkUrl, keyboardType: "url", autoCapitalize: "none", autoCorrect: false })),
                    PlatformIOS && React.createElement(View, { style: styles.lineSeparator }),
                    modalButtons))));
    }
    hideModal() {
        this.setState({
            showLinkDialog: false,
            linkInitialUrl: '',
            linkTitle: '',
            linkUrl: '',
        });
    }
    renderModalButtons() {
        const { linkTitle, linkUrl } = this.state;
        const insertUpdateDisabled = linkTitle.trim().length <= 0 || linkUrl.trim().length <= 0;
        const containerPlatformStyle = PlatformIOS
            ? { justifyContent: 'space-between' }
            : { paddingTop: 15 };
        const buttonPlatformStyle = PlatformIOS
            ? { flex: 1, height: 45, justifyContent: 'center' }
            : {};
        return (React.createElement(View, { style: [
                { alignSelf: 'stretch', flexDirection: 'row' },
                containerPlatformStyle,
            ] },
            !PlatformIOS && React.createElement(View, { style: { flex: 1 } }),
            React.createElement(TouchableOpacity, { onPress: this.hideModal, style: buttonPlatformStyle },
                React.createElement(Text, { style: [styles.button, { paddingRight: 10 }] }, this.upperCaseButtonTextIfNeeded('Cancel'))),
            React.createElement(TouchableOpacity, { onPress: this.handleInsertLink, disabled: insertUpdateDisabled, style: buttonPlatformStyle },
                React.createElement(Text, { style: [styles.button, { opacity: insertUpdateDisabled ? 0.5 : 1 }] }, this.upperCaseButtonTextIfNeeded(this.linkIsNew() ? 'Insert' : 'Update')))));
    }
    render() {
        //in release build, external html files in Android can't be required, so they must be placed in the assets folder and accessed via uri
        const pageSource = PlatformIOS
            ? require('./editor.html')
            : { uri: 'file:///android_asset/editor.html' };
        return (React.createElement(View, { style: { flex: 1 } },
            React.createElement(WebViewBridge, Object.assign({}, this.props, { hideKeyboardAccessoryView: true, keyboardDisplayRequiresUserAction: false, ref: this.captureWebviewRef, onBridgeMessage: this.onBridgeMessage, injectedJavaScript: injectScript, source: pageSource, onLoad: this.init })),
            this.renderLinkModal()));
    }
}
const styles = StyleSheet.create({
    modal: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    innerModal: {
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        paddingTop: 20,
        paddingBottom: PlatformIOS ? 0 : 20,
        paddingLeft: 20,
        paddingRight: 20,
        alignSelf: 'stretch',
        margin: 40,
        borderRadius: PlatformIOS ? 8 : 2,
    },
    button: {
        fontSize: 16,
        color: '#4a4a4a',
        textAlign: 'center',
    },
    inputWrapper: {
        marginTop: 5,
        marginBottom: 10,
        borderBottomColor: '#4a4a4a',
        borderBottomWidth: PlatformIOS ? 1 / PixelRatio.get() : 0,
    },
    inputTitle: {
        color: '#4a4a4a',
    },
    input: {
        height: PlatformIOS ? 20 : 40,
        paddingTop: 0,
    },
    lineSeparator: {
        height: 1 / PixelRatio.get(),
        backgroundColor: '#d5d5d5',
        marginLeft: -20,
        marginRight: -20,
        marginTop: 20,
    },
});
//# sourceMappingURL=RichTextEditor.js.map