import React, { PureComponent } from 'react'
import { FlatList, Image, TouchableOpacity } from 'react-native'
import { actions as webviewActions } from './const'
import RichTextEditor from './RichTextEditor'
import { ToolbarStyles as styles } from './styles'

const defaultActions = [
  webviewActions.insertImage,
  webviewActions.setBold,
  webviewActions.setItalic,
  webviewActions.insertBulletsList,
  webviewActions.insertOrderedList,
  webviewActions.insertLink,
]

const getDefaultIcon = () => ({
  [webviewActions.insertImage]: require('../img/icon_format_media.png'),
  [webviewActions.setBold]: require('../img/icon_format_bold.png'),
  [webviewActions.setItalic]: require('../img/icon_format_italic.png'),
  [webviewActions.insertBulletsList]: require('../img/icon_format_ul.png'),
  [webviewActions.insertOrderedList]: require('../img/icon_format_ol.png'),
  [webviewActions.insertLink]: require('../img/icon_format_link.png'),
})

// Types
interface IProps {
  getEditor: () => RichTextEditor
  actions?: string[]
  iconMap?: () => void
  iconTint?: string
  onPressAddImage?: () => void
  onPressAddLink?: () => void
  renderAction?: (action: string, selected: boolean) => React.ReactElement<{}>
  selectedButtonStyle?: {}
  selectedIconTint?: string
  style?: {}
  unselectedButtonStyle?: {}
}

interface IState {
  editor?: RichTextEditor
  selectedItems: string[]
}

interface IToolbarItem {
  action: string
  selected: boolean
}

// Helpers
const keyExtractor = (item: IToolbarItem, index: number) => item.action

// Component
export default class RichTextToolbar extends PureComponent<IProps, IState> {
  constructor() {
    super()
    this.state = {
      editor: undefined,
      selectedItems: [],
    }
  }

  componentDidMount() {
    const editor = this.props.getEditor()
    if (!editor) {
      throw new Error('Toolbar has no editor!')
    } else {
      editor.registerToolbar(selectedItems =>
        this.setSelectedItems(selectedItems)
      )
      this.setState({ editor })
    }
  }

  defaultRenderAction = (action: string, selected: boolean) => {
    const {
      iconTint,
      selectedIconTint,
      selectedButtonStyle,
      unselectedButtonStyle,
    } = this.props
    const icon = this.getButtonIcon(action)
    const handlePressAction = () => this.handlePressAction(action)
    return (
      <TouchableOpacity
        key={action}
        style={
          selected
            ? [styles.selectedButton, selectedButtonStyle]
            : [styles.unselectedButton, unselectedButtonStyle]
        }
        onPress={handlePressAction}
      >
        {icon
          ? <Image
              source={icon}
              style={{
                tintColor: selected ? selectedIconTint : iconTint,
              }}
            />
          : null}
      </TouchableOpacity>
    )
  }

  getButtonIcon = (action: string) => {
    const { iconMap } = this.props
    if (iconMap && iconMap[action]) {
      return iconMap[action]
    }
    const defaultIcon = getDefaultIcon()[action]
    if (defaultIcon) {
      return defaultIcon
    }
    return undefined
  }

  getRows = (actions: string[], selectedItems: string[]) =>
    actions.map(action => {
      return { action, selected: selectedItems.includes(action) }
    })

  handlePressAction = (action: string) => {
    const { onPressAddImage, onPressAddLink } = this.props
    const { editor } = this.state
    if (!editor) {
      return
    }
    switch (action) {
      case webviewActions.insertLink:
        editor.prepareInsert()
        if (onPressAddLink) {
          onPressAddLink()
        } else {
          editor.getSelectedText().then((selectedText: string) => {
            editor.showLinkDialog(selectedText)
          })
        }
        break
      case webviewActions.insertImage:
        editor.prepareInsert()
        if (onPressAddImage) {
          onPressAddImage()
        }
        break
      default:
        editor.sendAction(action)
        return
    }
  }

  renderItem = ({ item: { action, selected } }: { item: IToolbarItem }) =>
    this.props.renderAction
      ? this.props.renderAction(action, selected)
      : this.defaultRenderAction(action, selected)

  setSelectedItems = (selectedItems: string[]) =>
    selectedItems !== this.state.selectedItems
      ? this.setState({
          selectedItems,
        })
      : undefined

  render() {
    const { actions, style } = this.props
    const { selectedItems } = this.state
    const data = this.getRows(actions || defaultActions, selectedItems)
    return (
      <FlatList
        contentContainerStyle={[styles.listContainer, style]}
        data={data}
        horizontal
        keyExtractor={keyExtractor}
        renderItem={this.renderItem}
      />
    )
  }
}
