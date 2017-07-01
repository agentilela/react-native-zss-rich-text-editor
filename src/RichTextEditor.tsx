import React, { PureComponent } from 'react'
import {
  Dimensions,
  EmitterSubscription,
  Keyboard,
  Modal,
  NativeSyntheticEvent,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  WebView,
  WebViewMessageEventData,
  WebViewStatic,
} from 'react-native'
import { actions, messages } from './const'
import { EditorStyles as styles } from './styles'
import { InjectedMessageHandler } from './WebviewMessageHandler'

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

type BridgeMessage = NativeSyntheticEvent<WebViewMessageEventData>

// Helpers
const injectScript = `
  (function () {
    ${InjectedMessageHandler}
  }());
`

const PlatformIOS = Platform.OS === 'ios'

const upperCaseButtonTextIfNeeded = (buttonText: string) =>
  PlatformIOS ? buttonText : buttonText.toUpperCase()

// Component
export default class RichTextEditor extends PureComponent<IProps, IState> {
  // Event Listeners
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
  webviewBridge: WebViewStatic

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

  captureWebviewRef = (c: WebViewStatic) => (this.webviewBridge = c)

  handleKeyboardWillHide = (event: IKeyboardEvent) =>
    this.setState({ keyboardHeight: 0 })

  handleKeyboardWillShow = (event: IKeyboardEvent) => {
    const newKeyboardHeight = event.endCoordinates.height
    if (this.state.keyboardHeight === newKeyboardHeight) {
      return
    }
    return this.setState({ keyboardHeight: newKeyboardHeight }, () =>
      this.setEditorAvailableHeightBasedOnKeyboardHeight(newKeyboardHeight)
    )
  }

  onBridgeMessage = (incomingMessage: BridgeMessage) => {
    const { data } = incomingMessage.nativeEvent
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
    const { onChange, selectionChangeListeners } = this.state
    try {
      const message = JSON.parse(data)

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
          this.setPlatform()
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
          const { title, url } = message.data
          this.prepareInsert()
          this.showLinkDialog(title, url)
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
          selectionChangeListeners.map(listener => {
            listener(items)
          })
          break
        }
        case messages.CONTENT_CHANGE: {
          const content = message.data.content
          onChange.map(listener => listener(content))
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

  renderLinkModal = () => {
    const { keyboardHeight, linkTitle, linkUrl, showLinkDialog } = this.state
    const modalButtons = this.renderModalButtons()
    return (
      <Modal
        animationType="fade"
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
            <Text style={[styles.inputURL]}>URL</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                onChangeText={this.handleSetLinkUrl}
                style={styles.input}
                value={linkUrl}
              />
            </View>
            {PlatformIOS ? <View style={styles.lineSeparator} /> : null}
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

  hideModal = () =>
    this.setState({
      showLinkDialog: false,
      linkInitialUrl: '',
      linkTitle: '',
      linkUrl: '',
    })

  linkIsNew = () => !this.state.linkInitialUrl

  renderModalButtons = () => {
    const { linkTitle, linkUrl } = this.state
    const insertUpdateDisabled =
      linkTitle.trim().length <= 0 || linkUrl.trim().length <= 0
    return (
      <View style={styles.containerPlatformStyle}>
        {!PlatformIOS && <View style={{ flex: 1 }} />}
        <TouchableOpacity
          onPress={this.hideModal}
          style={styles.buttonPlatformStyle}
        >
          <Text style={[styles.button, { paddingRight: 10 }]}>
            {upperCaseButtonTextIfNeeded('Cancel')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={this.handleInsertLink}
          disabled={insertUpdateDisabled}
          style={styles.buttonPlatformStyle}
        >
          <Text
            style={[styles.button, { opacity: insertUpdateDisabled ? 0.5 : 1 }]}
          >
            {upperCaseButtonTextIfNeeded(
              this.linkIsNew() ? 'Insert' : 'Update'
            )}
          </Text>
        </TouchableOpacity>
      </View>
    )
  }

  sendAction = (action: string, data?: string | number | {}) =>
    this.webviewBridge.postMessage(JSON.stringify({ type: action, data }))

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

    this.setEditorHeight(
      Dimensions.get('window').height - keyboardHeight - spacing
    )
  }

  render() {
    //in release build, external html files in Android can't be required, so they must be placed in the assets folder and accessed via uri
    const pageSource = PlatformIOS
      ? require('./editor.html')
      : { uri: 'file:///android_asset/editor.html' }
    const linkModal = this.renderLinkModal()
    return (
      <View style={styles.editorContainer}>
        <WebView
          javaScriptEnabled
          injectedJavaScript={injectScript}
          onLoad={this.init}
          onMessage={this.onBridgeMessage}
          ref={this.captureWebviewRef}
          source={pageSource}
          {...this.props}
        />
        {linkModal}
      </View>
    )
  }

  //-------------------------------------------------------------------------------
  // Public API
  //-------------------------------------------------------------------------------

  // Event Listeners
  addSelectedTextChangeListener = (listener: () => void) =>
    this._selectedTextChangeListeners.push(listener)
  registerToolbar = (listener: (selectedItems: string[]) => void) =>
    this.setState({
      selectionChangeListeners: [
        ...this.state.selectionChangeListeners,
        listener,
      ],
    })
  registerContentChangeListener = (listener: () => void) =>
    this.setState({
      onChange: [...this.state.onChange, listener],
    })

  // Webview Message Handlers
  alignCenter = () => this.sendAction(actions.alignCenter)
  alignFull = () => this.sendAction(actions.alignFull)
  alignLeft = () => this.sendAction(actions.alignLeft)
  alignRight = () => this.sendAction(actions.alignRight)
  blurContentEditor = () => this.sendAction(actions.blurContentEditor)
  blurTitleEditor = () => this.sendAction(actions.blurTitleEditor)
  enableOnChange = () => this.sendAction(actions.enableOnChange)
  focusTitle = () => this.sendAction(actions.focusTitle)
  focusContent = () => this.sendAction(actions.focusContent)
  heading1 = () => this.sendAction(actions.heading1)
  heading2 = () => this.sendAction(actions.heading2)
  heading3 = () => this.sendAction(actions.heading3)
  heading4 = () => this.sendAction(actions.heading4)
  heading5 = () => this.sendAction(actions.heading5)
  heading6 = () => this.sendAction(actions.heading6)
  hideTitle = () => this.sendAction(actions.hideTitle)
  init = () => {
    this.sendAction(actions.init)
    if (this.props.footerHeight) {
      this.setFooterHeight()
    }
  }
  insertBulletsList = () => this.sendAction(actions.insertBulletsList)
  insertImage = (attributes: string) => {
    this.sendAction(actions.insertImage, attributes)
    this.prepareInsert() //This must be called BEFORE insertImage. But WebViewBridge uses a stack :/
  }
  insertLink = (url: string, title: string) =>
    this.sendAction(actions.insertLink, { url, title })
  insertOrderedList = () => this.sendAction(actions.insertOrderedList)
  prepareInsert = () => this.sendAction(actions.prepareInsert)
  removeFormat = () => this.sendAction(actions.removeFormat)
  restoreSelection = () => this.sendAction(actions.restoreSelection)
  setBackgroundColor = (color: string) =>
    this.sendAction(actions.setBackgroundColor, color)
  setTextColor = (color: string) => this.sendAction(actions.setTextColor, color)
  setTitlePlaceholder = (placeholder: string) =>
    this.sendAction(actions.setTitlePlaceholder, placeholder)
  setContentPlaceholder = (placeholder: string) =>
    this.sendAction(actions.setContentPlaceholder, placeholder)
  setCustomCSS = (css: string) => this.sendAction(actions.setCustomCSS, css)
  setBold = () => this.sendAction(actions.setBold)
  setContentFocusHandler = (callbackHandler: () => void) => {
    this.contentFocusHandler = callbackHandler
    return this.sendAction(actions.setContentFocusHandler)
  }
  setContentHTML = (html: string) =>
    this.sendAction(actions.setContentHtml, html)
  setEditorHeight = (height: number) =>
    this.sendAction(actions.setEditorHeight, height)
  setFooterHeight = () =>
    this.sendAction(actions.setFooterHeight, this.props.footerHeight)
  setPlatform = () => this.sendAction(actions.setPlatform, Platform.OS)
  setHR = () => this.sendAction(actions.setHR)
  setIndent = () => this.sendAction(actions.setIndent)
  setItalic = () => this.sendAction(actions.setItalic)
  setOutdent = () => this.sendAction(actions.setOutdent)
  setParagraph = () => this.sendAction(actions.setParagraph)
  setStrikethrough = () => this.sendAction(actions.setStrikethrough)
  setSubscript = () => this.sendAction(actions.setSubscript)
  setSuperscript = () => this.sendAction(actions.setSuperscript)
  setTitleFocusHandler = (callbackHandler: () => void) => {
    this.titleFocusHandler = callbackHandler
    return this.sendAction(actions.setTitleFocusHandler)
  }
  setTitleHTML = (html: string) => this.sendAction(actions.setTitleHtml, html)
  setUnderline = () => this.sendAction(actions.setUnderline)
  showTitle = () => this.sendAction(actions.showTitle)
  toggleTitle = () => this.sendAction(actions.toggleTitle)
  updateLink = (url: string, title: string) =>
    this.sendAction(actions.updateLink, { url, title })

  // Async Actions
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

  // Misc
  showLinkDialog = (optionalTitle: string = '', optionalUrl: string = '') =>
    this.setState({
      linkInitialUrl: optionalUrl,
      linkTitle: optionalTitle,
      linkUrl: optionalUrl,
      showLinkDialog: true,
    })
}
