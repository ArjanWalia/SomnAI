//
//  SomnAIWidgetBundle.swift
//  SomnAIWidget
//
//  Created by MANDEEP WALIA on 6/20/26.
//

import WidgetKit
import SwiftUI

@main
struct SomnAIWidgetBundle: WidgetBundle {
    var body: some Widget {
        SomnAIWidget()
        SomnAIWidgetControl()
        SomnAIWidgetLiveActivity()
    }
}
