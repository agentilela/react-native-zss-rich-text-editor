import React, { PureComponent } from 'react'
import {
  Dimensions,
  EmitterSubscription,
  Keyboard,
  Modal,
  PixelRatio,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import WebViewBridge from 'react-native-webview-bridge-updated'
import { actions, messages } from './const'
import { InjectedMessageHandler } from './WebviewMessageHandler'

const injectScript = `
  (function () {
    ${InjectedMessageHandler}
  }());
`

const PlatformIOS = Platform.OS === 'ios'

// Types
interface IProps {
  initialTitleHTML?: string
  initialContentHTML?: string
  titlePlaceholder?: string
  contentPlaceholder?: string
  editorInitializedCallback?: () => void
  customCSS?: string
  hiddenTitle?: boolean
  enableOnChange?: boolean
  footerHeight?: number
  contentInset?: { bottom?: number; top?: number }
  style?: { marginTop?: number; marginBottom?: number }
}

interface IState {
  keyboardHeight: number
  linkInitialUrl: string
  linkTitle: string
  linkUrl: string
  onChange: ((content: string) => void)[]
  selectionChangeListeners: ((selectedItems: string[]) => void)[]
  showLinkDialog: boolean
}

interface IKeyboardEvent {
  endCoordinates: {
    height: number
  }
}

export default class RichTextEditor extends PureComponent<IProps, IState> {
  _keyboardEventListeners: EmitterSubscription[]
  _selectedTextChangeListeners: ((text: string) => void)[]

  // Callback Handlers
  titleFocusHandler?: () => void
  contentFocusHandler?: () => void

  // Timeouts
  pendingContentHtml?: number
  pendingSelectedText?: number
  pendingTitleHtml?: number
  pendingTitleText?: number

  // Promises
  contentReject?: (reason?: string) => void
  contentResolve?: (value?: string) => void
  selectedTextResolve?: (value?: string) => void
  selectedTextReject?: (reason?: string) => void
  titleReject?: (reason?: string) => void
  titleResolve?: (value?: string) => void
  titleTextReject?: (reason?: string) => void
  titleTextResolve?: (value?: string) => void

  // Refs
  webviewBridge: typeof WebViewBridge

  constructor(props: IProps) {
    super(props)
    this.state = {
      selectionChangeListeners: [],
      onChange: [],
      showLinkDialog: false,
      linkInitialUrl: '',
      linkTitle: '',
      linkUrl: '',
      keyboardHeight: 0,
    }
  }

  componentWillMount() {
    if (PlatformIOS) {
      this._keyboardEventListeners = [
        Keyboard.addListener('keyboardWillShow', this.handleKeyboardWillShow),
        Keyboard.addListener('keyboardWillHide', this.handleKeyboardWillHide),
      ]
    } else {
      this._keyboardEventListeners = [
        Keyboard.addListener('keyboardDidShow', this.handleKeyboardWillShow),
        Keyboard.addListener('keyboardDidHide', this.handleKeyboardWillHide),
      ]
    }
  }

  componentWillUnmount() {
    this._keyboardEventListeners.forEach(eventListener =>
      eventListener.remove()
    )
  }

  captureWebviewRef = (c: typeof WebViewBridge) => (this.webviewBridge = c)

  handleKeyboardWillShow = (event: IKeyboardEvent) => {
    const newKeyboardHeight = event.endCoordinates.height
    if (this.state.keyboardHeight === newKeyboardHeight) {
      return
    }
    if (newKeyboardHeight) {
      this.setEditorAvailableHeightBasedOnKeyboardHeight(newKeyboardHeight)
    }
    this.setState({ keyboardHeight: newKeyboardHeight })
  }

  handleKeyboardWillHide = (event: IKeyboardEvent) =>
    this.setState({ keyboardHeight: 0 })

  setEditorAvailableHeightBasedOnKeyboardHeight = (keyboardHeight: number) => {
    const { contentInset, style } = this.props
    let spacing = 0
    if (contentInset) {
      const { top, bottom } = contentInset
      spacing += (top || 0) + (bottom || 0)
    }
    if (style) {
      const { marginTop, marginBottom } = style
      spacing += (marginTop || 0) + (marginBottom || 0)
    }

    const editorAvailableHeight =
      Dimensions.get('window').height - keyboardHeight - spacing
    this.setEditorHeight(editorAvailableHeight)
  }

  onBridgeMessage(str: string) {
    const {
      customCSS,
      contentPlaceholder,
      editorInitializedCallback,
      enableOnChange,
      hiddenTitle,
      initialContentHTML,
      initialTitleHTML,
      titlePlaceholder,
    } = this.props
    try {
      const message = JSON.parse(str)

      switch (message.type) {
        case messages.TITLE_HTML_RESPONSE:
          if (this.titleResolve) {
            this.titleResolve(message.data)
            this.titleResolve = undefined
            this.titleReject = undefined
            if (this.pendingTitleHtml) {
              clearTimeout(this.pendingTitleHtml)
              this.pendingTitleHtml = undefined
            }
          }
          break
        case messages.TITLE_TEXT_RESPONSE:
          if (this.titleTextResolve) {
            this.titleTextResolve(message.data)
            this.titleTextResolve = undefined
            this.titleTextReject = undefined
            if (this.pendingTitleText) {
              clearTimeout(this.pendingTitleText)
              this.pendingTitleText = undefined
            }
          }
          break
        case messages.CONTENT_HTML_RESPONSE:
          if (this.contentResolve) {
            this.contentResolve(message.data)
            this.contentResolve = undefined
            this.contentReject = undefined
            if (this.pendingContentHtml) {
              clearTimeout(this.pendingContentHtml)
              this.pendingContentHtml = undefined
            }
          }
          break
        case messages.SELECTED_TEXT_RESPONSE:
          if (this.selectedTextResolve) {
            this.selectedTextResolve(message.data)
            this.selectedTextResolve = undefined
            this.selectedTextReject = undefined
            if (this.pendingSelectedText) {
              clearTimeout(this.pendingSelectedText)
              this.pendingSelectedText = undefined
            }
          }
          break
        case messages.ZSS_INITIALIZED:
          if (customCSS) {
            this.setCustomCSS(customCSS)
          }

          if (contentPlaceholder) {
            this.setContentPlaceholder(contentPlaceholder)
          }

          if (initialContentHTML) {
            this.setContentHTML(initialContentHTML)
          }

          if (!hiddenTitle) {
            if (titlePlaceholder) {
              this.setTitlePlaceholder(titlePlaceholder)
            }
            if (initialTitleHTML) {
              this.setTitleHTML(initialTitleHTML)
            }
          } else {
            this.hideTitle()
          }

          if (enableOnChange) {
            this.enableOnChange()
          }

          if (editorInitializedCallback) {
            editorInitializedCallback()
          }

          break
        case messages.LINK_TOUCHED:
          this.prepareInsert()
          const { title, url } = message.data
          this.showLinkDialog(title, url)
          break
        case messages.SCROLL:
          this.webviewBridge.setNativeProps({
            contentOffset: { y: message.data },
          })
          break
        case messages.TITLE_FOCUSED:
          if (this.titleFocusHandler) {
            this.titleFocusHandler()
          }
          break
        case messages.CONTENT_FOCUSED:
          if (this.contentFocusHandler) {
            this.contentFocusHandler()
          }
          break
        case messages.SELECTION_CHANGE: {
          const items = message.data.items
          this.state.selectionChangeListeners.map(listener => {
            listener(items)
          })
          break
        }
        case messages.CONTENT_CHANGE: {
          const content = message.data.content
          this.state.onChange.map(listener => listener(content))
          break
        }
        case messages.SELECTED_TEXT_CHANGED: {
          const selectedText = message.data
          this._selectedTextChangeListeners.forEach(listener => {
            listener(selectedText)
          })
          break
        }
        default: {
          return
        }
      }
    } catch (e) {
      //alert('NON JSON MESSAGE');
    }
  }

  handleCloseLinkDialog = () => this.setState({ showLinkDialog: false })
  handleSetLinkTitle = (linkTitle: string) => this.setState({ linkTitle })
  handleSetLinkUrl = (linkUrl: string) => this.setState({ linkUrl })

  renderLinkModal() {
    const { keyboardHeight, linkTitle, linkUrl, showLinkDialog } = this.state
    const modalButtons = this.renderModalButtons()
    return (
      <Modal
        animationType={'fade'}
        onRequestClose={this.handleCloseLinkDialog}
        transparent
        visible={showLinkDialog}
      >
        <View style={styles.modal}>
          <View
            style={[
              styles.innerModal,
              { marginBottom: PlatformIOS ? keyboardHeight : 0 },
            ]}
          >
            <Text style={styles.inputTitle}>Title</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                onChangeText={this.handleSetLinkTitle}
                value={linkTitle}
              />
            </View>
            <Text style={[styles.inputTitle, { marginTop: 10 }]}>URL</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                onChangeText={this.handleSetLinkUrl}
                value={linkUrl}
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {PlatformIOS && <View style={styles.lineSeparator} />}
            {modalButtons}
          </View>
        </View>
      </Modal>
    )
  }
  handleInsertLink = () => {
    const { linkUrl, linkTitle } = this.state
    this.linkIsNew()
      ? this.insertLink(linkUrl, linkTitle)
      : this.updateLink(linkUrl, linkTitle)
    return this.hideModal()
  }

  hideModal() {
    this.setState({
      showLinkDialog: false,
      linkInitialUrl: '',
      linkTitle: '',
      linkUrl: '',
    })
  }

  renderModalButtons() {
    const { linkTitle, linkUrl } = this.state
    const insertUpdateDisabled =
      linkTitle.trim().length <= 0 || linkUrl.trim().length <= 0
    const containerPlatformStyle = PlatformIOS
      ? { justifyContent: 'space-between' }
      : { paddingTop: 15 }
    const buttonPlatformStyle = PlatformIOS
      ? { flex: 1, height: 45, justifyContent: 'center' }
      : {}
    return (
      <View
        style={[
          { alignSelf: 'stretch', flexDirection: 'row' },
          containerPlatformStyle,
        ]}
      >
        {!PlatformIOS && <View style={{ flex: 1 }} />}
        <TouchableOpacity onPress={this.hideModal} style={buttonPlatformStyle}>
          <Text style={[styles.button, { paddingRight: 10 }]}>
            {this.upperCaseButtonTextIfNeeded('Cancel')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={this.handleInsertLink}
          disabled={insertUpdateDisabled}
          style={buttonPlatformStyle}
        >
          <Text
            style={[styles.button, { opacity: insertUpdateDisabled ? 0.5 : 1 }]}
          >
            {this.upperCaseButtonTextIfNeeded(
              this.linkIsNew() ? 'Insert' : 'Update'
            )}
          </Text>
        </TouchableOpacity>
      </View>
    )
  }

  linkIsNew = () => !this.state.linkInitialUrl

  upperCaseButtonTextIfNeeded = (buttonText: string) =>
    PlatformIOS ? buttonText : buttonText.toUpperCase()

  render() {
    //in release build, external html files in Android can't be required, so they must be placed in the assets folder and accessed via uri
    const pageSource = PlatformIOS
      ? require('./editor.html')
      : { uri: 'file:///android_asset/editor.html' }
    return (
      <View style={{ flex: 1 }}>
        <WebViewBridge
          {...this.props}
          hideKeyboardAccessoryView={true}
          keyboardDisplayRequiresUserAction={false}
          ref={this.captureWebviewRef}
          onBridgeMessage={this.onBridgeMessage}
          injectedJavaScript={injectScript}
          source={pageSource}
          onLoad={this.init}
        />
        {this.renderLinkModal()}
      </View>
    )
  }

  escapeJSONString = (text: string) =>
    text
      .replace(/[\\]/g, '\\\\')
      .replace(/[\"]/g, '\\"')
      .replace(/[\']/g, "\\'")
      .replace(/[\/]/g, '\\/')
      .replace(/[\b]/g, '\\b')
      .replace(/[\f]/g, '\\f')
      .replace(/[\n]/g, '\\n')
      .replace(/[\r]/g, '\\r')
      .replace(/[\t]/g, '\\t')

  sendAction = (action: string, data?: string | number | {}) => {
    const jsonString = JSON.stringify({ type: action, data })
    this.webviewBridge.sendToBridge(this.escapeJSONString(jsonString))
  }

  //-------------------------------------------------------------------------------
  //--------------- Public API

  showLinkDialog = (optionalTitle: string = '', optionalUrl: string = '') =>
    this.setState({
      linkInitialUrl: optionalUrl,
      linkTitle: optionalTitle,
      linkUrl: optionalUrl,
      showLinkDialog: true,
    })

  focusTitle = () => this.sendAction(actions.focusTitle)

  focusContent = () => this.sendAction(actions.focusContent)

  registerToolbar = (listener: (selectedItems: string[]) => void) =>
    this.setState({
      selectionChangeListeners: [
        ...this.state.selectionChangeListeners,
        listener,
      ],
    })

  enableOnChange = () => this.sendAction(actions.enableOnChange)

  registerContentChangeListener = (listener: () => void) =>
    this.setState({
      onChange: [...this.state.onChange, listener],
    })

  setTitleHTML = (html: string) => this.sendAction(actions.setTitleHtml, html)
  hideTitle = () => this.sendAction(actions.hideTitle)
  showTitle = () => this.sendAction(actions.showTitle)
  toggleTitle = () => this.sendAction(actions.toggleTitle)
  setContentHTML = (html: string) =>
    this.sendAction(actions.setContentHtml, html)
  blurTitleEditor = () => this.sendAction(actions.blurTitleEditor)
  blurContentEditor = () => this.sendAction(actions.blurContentEditor)
  setBold = () => this.sendAction(actions.setBold)
  setItalic = () => this.sendAction(actions.setItalic)
  setUnderline = () => this.sendAction(actions.setUnderline)
  heading1 = () => this.sendAction(actions.heading1)
  heading2 = () => this.sendAction(actions.heading2)
  heading3 = () => this.sendAction(actions.heading3)
  heading4 = () => this.sendAction(actions.heading4)
  heading5 = () => this.sendAction(actions.heading5)
  heading6 = () => this.sendAction(actions.heading6)
  setParagraph = () => this.sendAction(actions.setParagraph)
  removeFormat = () => this.sendAction(actions.removeFormat)
  alignLeft = () => this.sendAction(actions.alignLeft)
  alignCenter = () => this.sendAction(actions.alignCenter)
  alignRight = () => this.sendAction(actions.alignRight)
  alignFull = () => this.sendAction(actions.alignFull)
  insertBulletsList = () => this.sendAction(actions.insertBulletsList)
  insertOrderedList = () => this.sendAction(actions.insertOrderedList)
  insertLink = (url: string, title: string) =>
    this.sendAction(actions.insertLink, { url, title })
  updateLink = (url: string, title: string) =>
    this.sendAction(actions.updateLink, { url, title })
  insertImage = (attributes: string) => {
    this.sendAction(actions.insertImage, attributes)
    this.prepareInsert() //This must be called BEFORE insertImage. But WebViewBridge uses a stack :/
  }
  setSubscript = () => this.sendAction(actions.setSubscript)
  setSuperscript = () => this.sendAction(actions.setSuperscript)
  setStrikethrough = () => this.sendAction(actions.setStrikethrough)
  setHR = () => this.sendAction(actions.setHR)
  setIndent = () => this.sendAction(actions.setIndent)
  setOutdent = () => this.sendAction(actions.setOutdent)
  setBackgroundColor = (color: string) =>
    this.sendAction(actions.setBackgroundColor, color)
  setTextColor = (color: string) => this.sendAction(actions.setTextColor, color)
  setTitlePlaceholder = (placeholder: string) =>
    this.sendAction(actions.setTitlePlaceholder, placeholder)
  setContentPlaceholder = (placeholder: string) =>
    this.sendAction(actions.setContentPlaceholder, placeholder)
  setCustomCSS = (css: string) => this.sendAction(actions.setCustomCSS, css)
  prepareInsert = () => this.sendAction(actions.prepareInsert)
  restoreSelection = () => this.sendAction(actions.restoreSelection)
  init = () => {
    this.sendAction(actions.init)
    this.setPlatform()
    if (this.props.footerHeight) {
      this.setFooterHeight()
    }
  }

  setEditorHeight = (height: number) =>
    this.sendAction(actions.setEditorHeight, height)

  setFooterHeight = () =>
    this.sendAction(actions.setFooterHeight, this.props.footerHeight)

  setPlatform = () => this.sendAction(actions.setPlatform, Platform.OS)

  getTitleHtml = () =>
    new Promise((resolve, reject) => {
      this.titleResolve = resolve
      this.titleReject = reject
      this.sendAction(actions.getTitleHtml)

      this.pendingTitleHtml = setTimeout(() => {
        if (this.titleReject) {
          this.titleReject('timeout')
        }
      }, 5000)
    })

  getTitleText = () =>
    new Promise((resolve, reject) => {
      this.titleTextResolve = resolve
      this.titleTextReject = reject
      this.sendAction(actions.getTitleText)

      this.pendingTitleText = setTimeout(() => {
        if (this.titleTextReject) {
          this.titleTextReject('timeout')
        }
      }, 5000)
    })

  getContentHtml = () =>
    new Promise((resolve, reject) => {
      this.contentResolve = resolve
      this.contentReject = reject
      this.sendAction(actions.getContentHtml)

      this.pendingContentHtml = setTimeout(() => {
        if (this.contentReject) {
          this.contentReject('timeout')
        }
      }, 5000)
    })

  getSelectedText = () =>
    new Promise((resolve, reject) => {
      this.selectedTextResolve = resolve
      this.selectedTextReject = reject
      this.sendAction(actions.getSelectedText)

      this.pendingSelectedText = setTimeout(() => {
        if (this.selectedTextReject) {
          this.selectedTextReject('timeout')
        }
      }, 5000)
    })

  setTitleFocusHandler = (callbackHandler: () => void) => {
    this.titleFocusHandler = callbackHandler
    return this.sendAction(actions.setTitleFocusHandler)
  }

  setContentFocusHandler = (callbackHandler: () => void) => {
    this.contentFocusHandler = callbackHandler
    return this.sendAction(actions.setContentFocusHandler)
  }

  addSelectedTextChangeListener = (listener: () => void) =>
    this._selectedTextChangeListeners.push(listener)
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
})
