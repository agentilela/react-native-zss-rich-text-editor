import { PixelRatio, Platform, StyleSheet } from 'react-native'

// Helpers
const PlatformIOS = Platform.OS === 'ios'

// Editor
export const EditorStyles = StyleSheet.create({
  button: {
    fontSize: 16,
    color: '#4a4a4a',
    textAlign: 'center',
  },
  buttonPlatformStyle: PlatformIOS
    ? { flex: 1, height: 45, justifyContent: 'center' }
    : {},
  containerPlatformStyle: PlatformIOS
    ? {
        alignSelf: 'stretch',
        flexDirection: 'row',
        justifyContent: 'space-between',
      }
    : { alignSelf: 'stretch', flexDirection: 'row', paddingTop: 15 },
  editorContainer: { flex: 1 },
  editor: { backgroundColor: 'transparent' },
  innerModal: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: PlatformIOS ? 8 : 2,
    margin: 40,
    paddingBottom: PlatformIOS ? 0 : 20,
    paddingLeft: 20,
    paddingRight: 20,
    paddingTop: 20,
  },
  inputWrapper: {
    marginTop: 5,
    marginBottom: 10,
  },
  inputTitle: {
    color: '#4a4a4a',
  },
  inputURL: {
    color: '#4a4a4a',
    marginTop: 10,
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
  modal: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
})

// Toolbar
const DEFAULT_BUTTON_SIZE = 50

export const ToolbarStyles = StyleSheet.create({
  listContainer: {
    alignItems: 'center',
    backgroundColor: '#D3D3D3',
    justifyContent: 'center',
    flexDirection: 'row',
    height: DEFAULT_BUTTON_SIZE,
    width: '100%',
  },
  selectedButton: {
    alignItems: 'center',
    backgroundColor: 'red',
    height: DEFAULT_BUTTON_SIZE,
    justifyContent: 'center',
    width: DEFAULT_BUTTON_SIZE,
  },
  unselectedButton: {
    alignItems: 'center',
    height: DEFAULT_BUTTON_SIZE,
    justifyContent: 'center',
    width: DEFAULT_BUTTON_SIZE,
  },
})
