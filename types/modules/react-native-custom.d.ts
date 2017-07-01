import { Component } from 'react'
import ReactNative, { FlatList } from 'react-native'
declare module 'react-native' {
  const VirtualizedList = FlatList
}
