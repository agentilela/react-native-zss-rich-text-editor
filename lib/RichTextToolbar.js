import React, { PureComponent } from 'react';
import { FlatList, Image, TouchableOpacity } from 'react-native';
import { actions as webviewActions } from './const';
import { ToolbarStyles as styles } from './styles';
const defaultActions = [
    webviewActions.insertImage,
    webviewActions.setBold,
    webviewActions.setItalic,
    webviewActions.insertBulletsList,
    webviewActions.insertOrderedList,
    webviewActions.insertLink,
];
const getDefaultIcon = () => ({
    [webviewActions.insertImage]: require('../img/icon_format_media.png'),
    [webviewActions.setBold]: require('../img/icon_format_bold.png'),
    [webviewActions.setItalic]: require('../img/icon_format_italic.png'),
    [webviewActions.insertBulletsList]: require('../img/icon_format_ul.png'),
    [webviewActions.insertOrderedList]: require('../img/icon_format_ol.png'),
    [webviewActions.insertLink]: require('../img/icon_format_link.png'),
});
// Helpers
const keyExtractor = (item, index) => item.action;
// Component
export default class RichTextToolbar extends PureComponent {
    constructor() {
        super();
        this.defaultRenderAction = (action, selected) => {
            const { iconTint, selectedIconTint, selectedButtonStyle, unselectedButtonStyle, } = this.props;
            const icon = this.getButtonIcon(action);
            const handlePressAction = () => this.handlePressAction(action);
            return (React.createElement(TouchableOpacity, { key: action, style: selected
                    ? [styles.selectedButton, selectedButtonStyle]
                    : [styles.unselectedButton, unselectedButtonStyle], onPress: handlePressAction }, icon
                ? React.createElement(Image, { source: icon, style: {
                        tintColor: selected ? selectedIconTint : iconTint,
                    } })
                : null));
        };
        this.getButtonIcon = (action) => {
            const { iconMap } = this.props;
            if (iconMap && iconMap[action]) {
                return iconMap[action];
            }
            const defaultIcon = getDefaultIcon()[action];
            if (defaultIcon) {
                return defaultIcon;
            }
            return undefined;
        };
        this.getRows = (actions, selectedItems) => actions.map(action => {
            return { action, selected: selectedItems.includes(action) };
        });
        this.handlePressAction = (action) => {
            const { onPressAddImage, onPressAddLink } = this.props;
            const { editor } = this.state;
            if (!editor) {
                return;
            }
            switch (action) {
                case webviewActions.insertLink:
                    editor.prepareInsert();
                    if (onPressAddLink) {
                        onPressAddLink();
                    }
                    else {
                        editor.getSelectedText().then((selectedText) => {
                            editor.showLinkDialog(selectedText);
                        });
                    }
                    break;
                case webviewActions.insertImage:
                    editor.prepareInsert();
                    if (onPressAddImage) {
                        onPressAddImage();
                    }
                    break;
                default:
                    editor.sendAction(action);
                    return;
            }
        };
        this.renderItem = ({ item: { action, selected } }) => this.props.renderAction
            ? this.props.renderAction(action, selected)
            : this.defaultRenderAction(action, selected);
        this.setSelectedItems = (selectedItems) => this.setState({
            selectedItems,
        });
        this.state = {
            editor: undefined,
            selectedItems: [],
        };
    }
    componentDidMount() {
        const editor = this.props.getEditor();
        if (!editor) {
            throw new Error('Toolbar has no editor!');
        }
        else {
            editor.registerToolbar(selectedItems => this.setSelectedItems(selectedItems));
            this.setState({ editor });
        }
    }
    render() {
        const { actions, style } = this.props;
        const { selectedItems } = this.state;
        const data = this.getRows(actions || defaultActions, selectedItems);
        return (React.createElement(FlatList, { contentContainerStyle: [styles.listContainer, style], data: data, horizontal: true, keyExtractor: keyExtractor, renderItem: this.renderItem }));
    }
}
//# sourceMappingURL=RichTextToolbar.js.map