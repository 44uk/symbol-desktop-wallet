/**
 * Copyright 2020 NEM Foundation (https://nem.io)
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *     http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {MosaicId, MosaicInfo, Mosaic} from 'nem2-sdk'
import {Component, Vue, Prop} from 'vue-property-decorator'
import {mapGetters} from 'vuex'

// child components
// @ts-ignore
import ErrorTooltip from '@/components/ErrorTooltip/ErrorTooltip.vue'
// @ts-ignore
import MosaicAmountDisplay from '@/components/MosaicAmountDisplay/MosaicAmountDisplay.vue'

type MosaicAttachmentType = {
  id: MosaicId,
  mosaicHex: string,
  name: string,
  amount: number,
}

@Component({
  components: {
    ErrorTooltip,
    MosaicAmountDisplay,
  },
  computed: {...mapGetters({
    networkMosaic: 'mosaic/networkMosaic',
    mosaicsInfo: 'mosaic/mosaicsInfoList',
    mosaicsNames: 'mosaic/mosaicsNames',
  })}
})
export class MosaicAttachmentDisplayTs extends Vue {

  @Prop({
    default: []
  }) value: MosaicAttachmentType[]

  /**
   * Whether to show absolute amounts or not
   */
  @Prop({
    default: false
  }) absolute: boolean

  /**
   * Networks currency mosaic
   * @var {MosaicId}
   */
  public networkMosaic: MosaicId

  /**
   * Network mosaics info (all)
   * @var {MosaicInfo[]}
   */
  public mosaicsInfo: MosaicInfo[]

  /**
   * List of known mosaics names
   * @var {any}
   */
  public mosaicsNames: any

  public attachedMosaics: MosaicAttachmentType[]

/// region computed properties getter/setter
  public get mosaics(): MosaicAttachmentType[] {
    console.log('get MosaicAttachmentDisplay.mosaics', this.attachedMosaics || this.value || [])
    return [].concat(...(this.attachedMosaics || this.value || []))
  }

  public set mosaics(attachments: MosaicAttachmentType[]) {
    console.log('set MosaicAttachmentDisplay.mosaics', attachments)
    this.attachedMosaics = attachments
    this.$emit('change', attachments)
  }
/// end-region computed properties getter/setter
}
