/*
 * MIT License
 *
 * Copyright (C) 2023 Huawei Device Co., Ltd.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { TurboModule, TurboModuleContext } from '@rnoh/react-native-openharmony/ts';
import {
  Album,
  PhotoThumbnail,
  GetPhotosParams,
  PhotoIdentifier,
  GetAlbumsParams,
  PhotoIdentifiersPage,
  PhotoConvertionOptions,
  PhotoThumbnailOptions,
  SaveToCameraRollOptions,
  SaveToCameraRollOptionsTypeMenu
} from './CameraRollParamTypes';
import photoAccessHelper from '@ohos.file.photoAccessHelper';
import dataSharePredicates from '@ohos.data.dataSharePredicates';
import util from '@ohos.util';
import image from '@ohos.multimedia.image';
import fs from '@ohos.file.fs';
const ASSET_TYPE_PHOTOS = 'Photos'
const ASSET_TYPE_VIDEOS = 'Videos'
const ASSET_TYPE_ALL = 'All'





export class CameraRollPermissionTurboModule extends TurboModule {
  private phAccessHelper: photoAccessHelper.PhotoAccessHelper

  constructor(ctx: TurboModuleContext) {
    super(ctx)
    this.phAccessHelper = photoAccessHelper.getPhotoAccessHelper(this.ctx.uiAbilityContext);
  }

  async save(uri: string, option: SaveToCameraRollOptions): Promise<string>{
    return await this.saveToCameraRoll(uri,option)
  }

  async saveToCameraRoll(uri: string, option: SaveToCameraRollOptions): Promise<string> {
    // 需要用到系统接口
    return new Promise<string>(async (resolve, reject) => {
      if(!uri){          // 需要确保fileUri对应的资源存在
        console.error(`Incorrect path.${uri}`);
        reject('Incorrect path.')
      }else {
        try {
          let context = this.ctx.uiAbilityContext;
          let phAccessHelper = photoAccessHelper.getPhotoAccessHelper(context);
          let fileUri:string = uri;
          if(option.type === SaveToCameraRollOptionsTypeMenu.photo){
            let assetChangeRequest: photoAccessHelper.MediaAssetChangeRequest = photoAccessHelper.MediaAssetChangeRequest.createImageAssetRequest(context, fileUri);
            await phAccessHelper.applyChanges(assetChangeRequest);
            console.info('createAsset successfully, uri: ' + assetChangeRequest.getAsset().uri);
            resolve('createAsset successfully, uri: ' + assetChangeRequest.getAsset().uri)
          }else if(option.type === SaveToCameraRollOptionsTypeMenu.video){
            let assetChangeRequest: photoAccessHelper.MediaAssetChangeRequest = photoAccessHelper.MediaAssetChangeRequest.createVideoAssetRequest(context, fileUri);
            await phAccessHelper.applyChanges(assetChangeRequest);
            console.info('createAsset successfully, uri: ' + assetChangeRequest.getAsset().uri);
            resolve('createAsset successfully, uri: ' + assetChangeRequest.getAsset().uri)
          }
        } catch (err) {
          console.error(`create asset failed with error: ${err.code}, ${err.message} file:===>${uri}`);
          reject(`create asset failed with error: ${err.code}, ${err.message} file:===>${uri}`)
        }
      }
    })
  }


  releaseCapture(uri: string) {
    let file = fs.openSync(uri, fs.OpenMode.READ_WRITE);
    let path = file.path;
    if (path == null) return;
    fs.access(path).then((res: boolean) => {
      if (!res) {
        return;
      }
      if (file.getParent() == this.ctx.uiAbilityContext.cacheDir) {
        fs.unlinkSync(path);
      }
    })
    fs.closeSync(file);
  }

  getPhotos(params: GetPhotosParams): Promise<PhotoIdentifiersPage> {
    return new Promise<PhotoIdentifiersPage>((resolve, reject) => {
      let first = params.first
      let after = params.after
      let groupTypes = params.groupTypes
      let groupName = params.groupName
      let includeSharedAlbums = params.includeSharedAlbums
      let assetType = params.assetType
      let fromTime = params.fromTime
      let toTime = params.toTime
      let mimeTypes = params.mimeTypes
      let include = params.include

      let queryBegin = parseInt(this.isEmpty(after) ? '0' : after);
      let predicates = new dataSharePredicates.DataSharePredicates()
      predicates.in("media_type", mimeTypes)
      predicates.limit(first + 1, queryBegin)
      predicates.orderByDesc("date_added").orderByDesc("date_modified")
      let fetchOptions: photoAccessHelper.FetchOptions = {
        fetchColumns: [
          photoAccessHelper.PhotoKeys.URI,
          photoAccessHelper.PhotoKeys.PHOTO_TYPE,
          photoAccessHelper.PhotoKeys.DISPLAY_NAME,
          photoAccessHelper.PhotoKeys.SIZE,
          photoAccessHelper.PhotoKeys.DATE_ADDED,
          photoAccessHelper.PhotoKeys.DATE_MODIFIED,
          photoAccessHelper.PhotoKeys.DURATION,
          photoAccessHelper.PhotoKeys.WIDTH,
          photoAccessHelper.PhotoKeys.HEIGHT,
          photoAccessHelper.PhotoKeys.ORIENTATION,
          photoAccessHelper.PhotoKeys.DATE_TAKEN,
          photoAccessHelper.PhotoKeys.FAVORITE,
          photoAccessHelper.PhotoKeys.TITLE],
        predicates: predicates
      };
      this.phAccessHelper.getAssets(fetchOptions).then((fetchResult) => {
        if (fetchResult !== undefined) {
          fetchResult.getAllObjects().then((photoAssets) => {
            if (photoAssets !== undefined && photoAssets.length != 0) {
              let has_next_page: boolean = first < photoAssets.length
              let pageInfo: {
                has_next_page: boolean;
                start_cursor?: string;
                end_cursor?: string;
              } = {
                has_next_page: has_next_page,
                end_cursor: has_next_page ? (queryBegin + first).toString() : ''
              }
              let photos: Array<PhotoIdentifier> = new Array<PhotoIdentifier>()
              photoAssets.forEach(photoAsset => {
                let type: string = photoAsset.photoType == 1 ? 'IMAGE' : 'VIDEO'
                let photo: PhotoIdentifier = {
                  node: {
                    type: type,
                    image: {
                      filename: photoAsset.displayName,
                      filepath: null,
                      extension: null,
                      uri: photoAsset.uri,
                      height: parseInt(photoAsset.get(photoAccessHelper.PhotoKeys.HEIGHT).toString()),
                      width: parseInt(photoAsset.get(photoAccessHelper.PhotoKeys.WIDTH).toString()),
                      fileSize: parseInt(photoAsset.get(photoAccessHelper.PhotoKeys.SIZE).toString()),
                      playableDuration: parseInt(photoAsset.get(photoAccessHelper.PhotoKeys.DURATION).toString()),
                      orientation: parseInt(photoAsset.get(photoAccessHelper.PhotoKeys.ORIENTATION).toString()),
                    },
                    timestamp: parseInt(photoAsset.get(photoAccessHelper.PhotoKeys.DATE_ADDED).toString()),
                    modificationTimestamp: parseInt(photoAsset.get(photoAccessHelper.PhotoKeys.DATE_MODIFIED).toString()),
                    location: null
                  }
                }
                photos.push(photo)
              })
              let resulPage: PhotoIdentifiersPage = {
                edges: photos,
                page_info: pageInfo,
              }
              resolve(resulPage)
            }
          })
        }
      }).catch(err => {
        console.error('getPhotos failed with err: ' + err);
      })
    })
  }

  getAlbums(params: GetAlbumsParams): Promise<Album[]> {
    return new Promise<Album[]>((resolve, reject) => {
      let albumSubtype;
      if (ASSET_TYPE_PHOTOS == params.assetType) {
        albumSubtype = photoAccessHelper.AlbumSubtype.USER_GENERIC
      } else if (ASSET_TYPE_VIDEOS == params.assetType) {
        albumSubtype = photoAccessHelper.AlbumSubtype.VIDEO
      } else if (ASSET_TYPE_ALL == params.assetType) {
        albumSubtype = photoAccessHelper.AlbumSubtype.ANY
      }
      this.phAccessHelper.getAlbums(photoAccessHelper.AlbumType.USER, albumSubtype).then(result => {
        let resultAlbums: Album[] = new Array();
        result.getAllObjects().then(albums => {
          albums.forEach(album => {
            resultAlbums.push({ title: album.albumName, count: album.count })
          })
          resolve(resultAlbums);
        })
      }).catch((err: Error) => {
        console.error('getAlbums failed with err: ' + err);
        reject(`Could not get media, ${JSON.stringify(err)}`)
      })
    })
  }

  deletePhotos(photoUris: Array<string>): Promise<void> {
    // this.phAccessHelper.deleteAssets 为系统接口
    return new Promise<void>((resolve, reject) => {
    })
  }

  getPhotoByInternalID(internalID: string, options: PhotoConvertionOptions): Promise<PhotoIdentifier> {
    // internalID  IOS特有
    return new Promise<PhotoIdentifier>((resolve, reject) => {
      this.getPhotoByUri(internalID).then(photoAsset => {
        let type: string = photoAsset.photoType == 1 ? 'IMAGE' : 'VIDEO'
        let photo: PhotoIdentifier = {
          node: {
            type: type,
            image: {
              filename: photoAsset.displayName,
              filepath: null,
              extension: null,
              uri: photoAsset.uri,
              height: parseInt(photoAsset.get(photoAccessHelper.PhotoKeys.HEIGHT).toString()),
              width: parseInt(photoAsset.get(photoAccessHelper.PhotoKeys.WIDTH).toString()),
              fileSize: parseInt(photoAsset.get(photoAccessHelper.PhotoKeys.SIZE).toString()),
              playableDuration: parseInt(photoAsset.get(photoAccessHelper.PhotoKeys.DURATION).toString()),
              orientation: parseInt(photoAsset.get(photoAccessHelper.PhotoKeys.ORIENTATION).toString()),
            },
            timestamp: parseInt(photoAsset.get(photoAccessHelper.PhotoKeys.DATE_ADDED).toString()),
            modificationTimestamp: parseInt(photoAsset.get(photoAccessHelper.PhotoKeys.DATE_MODIFIED).toString()),
            location: null
          }
        }
        resolve(photo)
      })
    })
  }

  getPhotoThumbnail(internalID: string, options: PhotoThumbnailOptions): Promise<PhotoThumbnail> {
    // internalID  IOS特有
    return new Promise<PhotoThumbnail>((resolve, reject) => {
      this.getPhotoByUri(internalID).then(photoAsset => {
        photoAsset.getThumbnail({ height: options.targetSize.height, width: options.targetSize.width }).then(pixMap => {
          var base64 = new util.Base64Helper();
          let packOpts: image.PackingOption = {
            format: "image/jpeg", quality: options.quality * 100
          }
          let imagePackerApi = image.createImagePacker()
          imagePackerApi.packing(pixMap, packOpts).then(arrayBuffer => {
            base64.encodeToString(new Uint8Array(arrayBuffer)).then(base64String => {
              resolve({ thumbnailBase64: base64String })
            })
          })
        })
      })
    })
  }

  isEmpty(str: string): boolean {
    if (str === null || str === undefined || str.trim().length === 0) {
      return true
    }
    return false;
  }

  getPhotoByUri(uri: string): Promise<photoAccessHelper.PhotoAsset> {
    return new Promise<photoAccessHelper.PhotoAsset>((resolve, reject) => {
      let predicates = new dataSharePredicates.DataSharePredicates()
      predicates.equalTo("uri", uri);
      let fetchOptions: photoAccessHelper.FetchOptions = {
        fetchColumns: [
          photoAccessHelper.PhotoKeys.URI,
          photoAccessHelper.PhotoKeys.PHOTO_TYPE,
          photoAccessHelper.PhotoKeys.DISPLAY_NAME,
          photoAccessHelper.PhotoKeys.SIZE,
          photoAccessHelper.PhotoKeys.DATE_ADDED,
          photoAccessHelper.PhotoKeys.DATE_MODIFIED,
          photoAccessHelper.PhotoKeys.DURATION,
          photoAccessHelper.PhotoKeys.WIDTH,
          photoAccessHelper.PhotoKeys.HEIGHT,
          photoAccessHelper.PhotoKeys.ORIENTATION,
          photoAccessHelper.PhotoKeys.DATE_TAKEN,
          photoAccessHelper.PhotoKeys.FAVORITE,
          photoAccessHelper.PhotoKeys.TITLE],
        predicates: predicates
      };
      this.phAccessHelper.getAssets(fetchOptions).then((fetchResult) => {
        fetchResult.getFirstObject().then(photoAsset => {
          resolve(photoAsset);
        })
      })
    })
  }
}