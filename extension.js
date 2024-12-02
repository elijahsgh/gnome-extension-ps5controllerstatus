/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import GObject from 'gi://GObject';
import St from 'gi://St';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Cogl from 'gi://Cogl';
import Clutter from 'gi://Clutter';

const upowerCommand = 'upower -i $(upower -e | grep ps_controller) | grep percent'

function getStatus(status) {
    const proc = Gio.Subprocess.new(
        ['/bin/bash', '-c', upowerCommand],
        Gio.SubprocessFlags.STDOUT_PIPE,
    );

    const stdoutStream = new Gio.DataInputStream({
        base_stream: proc.get_stdout_pipe(),
        close_base_stream: true
    });

    let result = '';

    const [line] = stdoutStream.read_line_utf8(null);
    if (line) {
        result = line.substr(line.lastIndexOf(' ')+1);
    }

    if (result !== '') {
        return result;
    }

    return '--';
};

// Indicator.js
const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, _('PS5 Controller Status Indicator'));

        const hbox = new St.BoxLayout({
            style: 'spacing: 6px;',
        });

        hbox.add_child(this._icon = new St.Icon({
            icon_name: 'applications-games-symbolic',
            style_class: 'system-status-icon',
        }));

        hbox.add_child(this._buttonText = new St.Label({
            text: '--',
        }));

        this.add_child(hbox);

        let item = new PopupMenu.PopupMenuItem(_('Get PS5 Controller Status'));

        item.connect('activate', () => {
            let statusText = getStatus();
            let message = "Controller is not connected";

            updateIcon(this, statusText);

            if (statusText !== '--') {
                message = `Controller is connected: ${statusText}`;
            }

            Main.notify(_("Status"), _(message))
        });

        this.menu.addMenuItem(item);

        this._currentBatteryStatus = -1;
        this._currentWarningLevelGreen = new Cogl.Color({
            red: 0,
            green: 255,
            blue: 0,
            alpha: 255,
        });

        this._currentWarningLevelYellow = new Cogl.Color({
            red: 255,
            green: 255,
            blue: 0,
            alpha: 255,
        });

        this._currentWarningLevelRed = new Cogl.Color({
            red: 255,
            green: 0,
            blue: 0,
            alpha: 255,
        });
    }
});

function updateIcon(indicator, statusText) {
    let batteryStatus = -1;

    if (statusText !== '--') {
        const intStatusText = parseInt(statusText.replace('%', ''));
        let color = null;

        if (intStatusText > 50) {
            batteryStatus = 2;
            color = indicator._currentWarningLevelGreen;
        } else if (intStatusText > 20) {
            batteryStatus = 1;
            color = indicator._currentWarningLevelYellow;                
        } else if (intStatusText > 0) {
            batteryStatus = 0;
            color = indicator._currentWarningLevelRed;               
        }

        if (indicator._currentBatteryStatus !== batteryStatus) {
            if (indicator._icon.has_effects()) {
                indicator._icon.remove_effect_by_name('color');
            }
        
            const colorizer = new Clutter.ColorizeEffect({tint: color});
            indicator._icon.add_effect_with_name('color', colorizer);
            indicator._currentBatteryStatus = batteryStatus;
        }
    } else {
        if (indicator._icon.has_effects()) {
            indicator._icon.remove_effect_by_name('color');
        }                
        indicator._currentBatteryStatus = -1;
    }
    indicator._buttonText.text = statusText;
    indicator._currentBatteryStatus = batteryStatus;
}

export default class IndicatorExampleExtension extends Extension {
    enable() {
        this._indicator = new Indicator();
        updateIcon(this._indicator, getStatus());
        Main.panel.addToStatusArea(this.uuid, this._indicator);
        this._timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
            updateIcon(this._indicator, getStatus());
            return GLib.SOURCE_CONTINUE;
         });
    }

    disable() {
        this._indicator.destroy();
        this._indicator = null;
        if (this._timeout) {
            GLib.Source.remove(this._timeout)
        }
        this._timeout = null
    }
}
