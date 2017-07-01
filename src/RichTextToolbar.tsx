import React, { PureComponent } from 'react'
import { FlatList, Image, StyleSheet, TouchableOpacity } from 'react-native'
import { actions } from './const'
import RichTextEditor from './RichTextEditor'

const defaultActions = [
  actions.insertImage,
  actions.setBold,
  actions.setItalic,
  actions.insertBulletsList,
  actions.insertOrderedList,
  actions.insertLink,
]

const getDefaultIcon = () => ({
  [actions.insertImage]: require('../img/icon_format_media.png'),
  [actions.setBold]: require('../img/icon_format_bold.png'),
  [actions.setItalic]: require('../img/icon_format_italic.png'),
  [actions.insertBulletsList]: require('../img/icon_format_ul.png'),
  [actions.insertOrderedList]: require('../img/icon_format_ol.png'),
  [actions.insertLink]: require('../img/icon_format_link.png'),
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
  actions: string[]
}

// Component
export default class RichTextToolbar extends PureComponent<IProps, IState> {
  constructor(props: IProps) {
    super(props)
    this.state = {
      editor: undefined,
      selectedItems: [],
      actions: props.actions ? props.actions : defaultActions,
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

  getRows = (actions: string[], selectedItems: string[]) =>
    actions.map(action => {
      return { action, selected: selectedItems.includes(action) }
    })

  setSelectedItems = (selectedItems: string[]) =>
    selectedItems !== this.state.selectedItems
      ? this.setState({
          selectedItems,
        })
      : undefined

  getButtonSelectedStyle = () =>
    this.props.selectedButtonStyle
      ? this.props.selectedButtonStyle
      : styles.defaultSelectedButton

  getButtonUnselectedStyle = () =>
    this.props.unselectedButtonStyle
      ? this.props.unselectedButtonStyle
      : styles.defaultUnselectedButton

  getButtonIcon = (action: string) => {
    if (this.props.iconMap && this.props.iconMap[action]) {
      return this.props.iconMap[action]
    }
    const defaultIcon = getDefaultIcon()[action]
    if (defaultIcon) {
      return defaultIcon
    }
    return undefined
  }

  defaultRenderAction = (action: string, selected: boolean) => {
    const icon = this.getButtonIcon(action)
    const handlePressAction = () => this.handlePressAction(action)
    return (
      <TouchableOpacity
        key={action}
        style={[
          { height: 50, width: 50, justifyContent: 'center' },
          selected
            ? this.getButtonSelectedStyle()
            : this.getButtonUnselectedStyle(),
        ]}
        onPress={handlePressAction}
      >
        {icon
          ? <Image
              source={icon}
              style={{
                tintColor: selected
                  ? this.props.selectedIconTint
                  : this.props.iconTint,
              }}
            />
          : null}
      </TouchableOpacity>
    )
  }

  renderAction = (action: string, selected: boolean) =>
    this.props.renderAction
      ? this.props.renderAction(action, selected)
      : this.defaultRenderAction(action, selected)

  handlePressAction = (action: string) => {
    const { editor } = this.state
    if (!editor) {
      return
    }
    switch (action) {
      case actions.setBold:
      case actions.setItalic:
      case actions.insertBulletsList:
      case actions.insertOrderedList:
      case actions.setUnderline:
      case actions.heading1:
      case actions.heading2:
      case actions.heading3:
      case actions.heading4:
      case actions.heading5:
      case actions.heading6:
      case actions.setParagraph:
      case actions.removeFormat:
      case actions.alignLeft:
      case actions.alignCenter:
      case actions.alignRight:
      case actions.alignFull:
      case actions.setSubscript:
      case actions.setSuperscript:
      case actions.setStrikethrough:
      case actions.setHR:
      case actions.setIndent:
      case actions.setOutdent:
        editor.sendAction(action)
        break
      case actions.insertLink:
        editor.prepareInsert()
        if (this.props.onPressAddLink) {
          this.props.onPressAddLink()
        } else {
          editor.getSelectedText().then((selectedText: string) => {
            editor.showLinkDialog(selectedText)
          })
        }
        break
      case actions.insertImage:
        editor.prepareInsert()
        if (this.props.onPressAddImage) {
          this.props.onPressAddImage()
        }
        break
      default:
        return
    }
  }

  renderItem = ({
    item,
    index,
  }: {
    item: { action: string; selected: boolean }
    index: number
  }) => this.renderAction(item.action, item.selected)

  render() {
    const { actions } = this.props
    const { selectedItems } = this.state
    const data = this.getRows(actions || defaultActions, selectedItems)
    return (
      <FlatList
        contentContainerStyle={[styles.listContainer, this.props.style]}
        data={data}
        horizontal
        renderItem={this.renderItem}
      />
    )
  }
}

const styles = StyleSheet.create({
  defaultSelectedButton: {
    backgroundColor: 'red',
  },
  defaultUnselectedButton: {},
  listContainer: {
    height: 50,
    backgroundColor: '#D3D3D3',
    alignItems: 'center',
    flexDirection: 'row',
  },
})
