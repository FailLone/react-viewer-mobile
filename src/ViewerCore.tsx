import * as React from 'react';
import './style/index.less';
import ViewerProps, { ImageDecorator } from './ViewerProps';
import ViewerCanvas from './ViewerCanvas';

const MAX_SIZE_SCALE: number = .9;
const DEFAULT_IMAGE_WIDTH: number = window.innerWidth * MAX_SIZE_SCALE;
const DEFAULT_IMAGE_HEIGHT: number = window.innerWidth * MAX_SIZE_SCALE;
const MIN_TOP = -60;
const MAX_TOP = 60;

function noop() {}

export interface Point {
  x: number;
  y: number;
}

export interface ViewerCoreState {
  activeIndex: number;
  width: number;
  height: number;
  top: number;
  left: number;
  scale: number;
  imageWidth: number;
  imageHeight: number;
  touch: boolean;
  swiperDistance: number;
  touchStartTime: number;
  startScale: number;
  startX: number;
  startY: number;
  moveX: number;
  moveY: number;
  zoomCenterX: number;
  zoomCenterY: number;
  touchDistance: number;
  pinchScale: number;
  multiTouch: boolean;
}

type Direction = 'not' | 'up' | 'down' | 'left' | 'right';

export default class ViewerCore extends React.Component<ViewerProps, Partial<ViewerCoreState>> {
  static defaultProps = {
    visible: false,
    onClose: noop,
    images: [],
    activeIndex: 0,
    zIndex: 1000,
  };

  prefixCls: string;
  containerWidth: number;
  containerHeight: number;
  moveLock: boolean;
  direction: Direction;

  // test
  text1: string;
  text2: string;

  constructor(props) {
    super(props);

    this.prefixCls = 'react-viewer-mobile';
    this.state = {
      activeIndex: this.props.activeIndex,
      scale: 1,
      touch: false,
      swiperDistance: 0,
      touchStartTime: 0,
      touchDistance: 0,
      startX: 0,
      startY: 0,
      moveX: 0,
      moveY: 0,
      pinchScale: 1,
      zoomCenterX: 0,
      zoomCenterY: 0,
    };

    this.containerWidth = window.innerWidth;
    this.containerHeight = window.innerHeight;
    this.moveLock = false;
    this.direction = 'not';
  }

  handleBodyTouchmove = e => {
    e.preventDefault();
  }

  handleTouchStart(e) {
    e.preventDefault();
    e.stopPropagation();
    let touchDistance = 0;
    let zoomCenterX = 0;
    let zoomCenterY = 0;
    let multiTouch = false;
    let touchStartTime = Date.now();
    if (e.touches.length > 1 && this.state.swiperDistance === 0) {
      touchDistance = this.getDistance({
        x: e.touches[0].pageX,
        y: e.touches[0].pageY,
      }, {
        x: e.touches[1].pageX,
        y: e.touches[1].pageY,
      });
      zoomCenterX = e.touches[0].pageX + (e.touches[1].pageX - e.touches[0].pageX) / 2;
      zoomCenterY = e.touches[0].pageY + (e.touches[1].pageY - e.touches[0].pageY) / 2;
      multiTouch = true;
    }
    let startX = e.touches[0].pageX;
    let startY = e.touches[0].pageY;
    this.setState({
      touch: true,
      startX: startX,
      startY: startY,
      moveX: startX,
      moveY: startY,
      startScale: this.state.scale,
      touchDistance,
      zoomCenterX,
      zoomCenterY,
      multiTouch,
      touchStartTime,
    });
  }

  handleTouchMove(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.touches.length > 1) {
      let touchDistance = this.getDistance({
        x: e.touches[0].pageX,
        y: e.touches[0].pageY,
      }, {
        x: e.touches[1].pageX,
        y: e.touches[1].pageY,
      });
      let pinchScale = touchDistance / this.state.touchDistance;
      let newScale = this.state.scale + this.state.startScale * (pinchScale - this.state.pinchScale);
      if (newScale <= 3 && this.state.swiperDistance === 0) {
        this.handleZoom(this.state.zoomCenterX, this.state.zoomCenterY, newScale, pinchScale);
      }
    }else {
      let newLeft = this.state.left + e.touches[0].pageX - this.state.moveX;
      let newTop = this.state.top + e.touches[0].pageY - this.state.moveY;
      const direction = this.getDirection(this.state.moveX, this.state.moveY, e.touches[0].pageX, e.touches[0].pageY);
      if (!this.moveLock) {
        this.direction = direction;
      }
      if (this.direction === 'up' || this.direction === 'down') {
        if (this.state.height <= this.containerHeight) {
          return;
        }
        this.moveLock = true;
        if ((newTop + this.state.height) - this.containerHeight < MIN_TOP) {
          newTop = this.state.top;
        }
        this.setState({
          left: this.state.scale === 1 ? this.state.left : newLeft,
          top: Math.min(newTop, MAX_TOP),
          moveX: e.touches[0].pageX,
          moveY: e.touches[0].pageY,
        });
      }
      if (this.direction === 'left' || this.direction === 'right') {
        this.moveLock = true;
        let swiperDistance = this.state.swiperDistance + e.touches[0].pageX - this.state.moveX;
        this.setState({
          swiperDistance: swiperDistance,
          moveX: e.touches[0].pageX,
          moveY: e.touches[0].pageY,
        });
      }
    }
  }

  getDirection = (startX, startY, endX, endY): Direction => {
    function getAngle(angX, angY) {
      return Math.atan2(angY, angX) * 180 / Math.PI;
    }

    const angX = endX - startX;
    const angY = endY - startY;

    // 如果滑动距离太短
    if (Math.abs(angX) < 2 && Math.abs(angY) < 2) {
      return 'not';
    }

    const angle = getAngle(angX, angY);
    if (angle >= -135 && angle <= -45) {
      return 'up';
    } else if (angle > 45 && angle < 135) {
      return 'down';
    } else if ((angle >= 135 && angle <= 180) || (angle >= -180 && angle < -135)) {
      return 'left';
    } else if (angle >= -45 && angle <= 45) {
      return 'right';
    }
  }

  isUpDownDirection = () => {
    return this.direction === 'up' || this.direction === 'down';
  }

  handleTouchEnd(e) {
    e.preventDefault();
    e.stopPropagation();
    this.moveLock = false;
    let touchInterval = Date.now() - this.state.touchStartTime;
    if (e.touches.length === 0) {
      if (this.state.multiTouch) {
        if (this.state.scale < 1) {
          setTimeout(() => {
            this.resetImage();
          }, 0);
        }
      }else {
        if (this.isUpDownDirection()) {
          let top = this.state.top;
          let left = this.state.left;
          if ((this.state.top + this.state.height) < this.containerHeight
          && (this.state.height > this.containerHeight)) {
            top = this.containerHeight - this.state.height;
          }
          if (this.state.top >= MAX_TOP && this.state.height > this.containerHeight) {
            top = 0;
          }
          if (left > 0) {
            left = 0;
          }
          if ((left + this.state.width) < this.containerWidth) {
            left = this.containerWidth - this.state.width;
          }
          this.setState({
            top,
            left,
            touch: false,
          });
          return;
        }

        this.direction = 'not';
        if (this.state.swiperDistance !== 0) {
          let criticalValue = this.containerWidth * .4;
          let canChange = false;
          let shortTime = touchInterval < 300;
          if (this.state.swiperDistance <= -criticalValue ||
          this.state.swiperDistance >= criticalValue || shortTime) {
            canChange = true;
          }
          if (canChange) {
            let newActiveIndex;
            if (this.state.swiperDistance <= -criticalValue ||
            (shortTime && this.state.swiperDistance < 0)) {
              newActiveIndex = this.state.activeIndex + 1;
              if (newActiveIndex === this.props.images.length) {
                newActiveIndex = this.state.activeIndex;
              }
            }
            if (this.state.swiperDistance >= criticalValue ||
            (shortTime && this.state.swiperDistance > 0)) {
              newActiveIndex = this.state.activeIndex - 1;
              if (newActiveIndex < 0) {
                newActiveIndex = this.state.activeIndex;
              }
            }
            this.loadImg(newActiveIndex);
          }else {
            this.setState({
              swiperDistance: 0,
              touch: false,
            });
          }
        }else {
          if (Math.abs(this.state.moveX - this.state.startX) > 10 ||
          Math.abs(this.state.moveY - this.state.startY) > 10) {
          }else {
            if (touchInterval < 500) {
              this.close();
              // this.setState({
              //   visible: false,
              // });
            }
          }
        }
      }
      this.setState({
        startX: 0,
        startY: 0,
        moveX: 0,
        moveY: 0,
        pinchScale: 1,
        touchDistance: 0,
        multiTouch: false,
        touch: false,
        touchStartTime: 0,
      });
    }else {
      this.setState({
        moveX: e.touches[0].pageX,
        moveY: e.touches[0].pageY,
      });
    }
  }

  resetImage() {
    const imgDefaultSize = this.getImgDefaultSize(this.state.imageWidth, this.state.imageHeight);
    this.setState({
      width: imgDefaultSize.width,
      height: imgDefaultSize.height,
      left: imgDefaultSize.left,
      top:  imgDefaultSize.top,
      scale: 1,
      touch: false,
    });
  }

  getImageCenterXY() {
    return {
      x: this.state.left + this.state.width / 2,
      y: this.state.top + this.state.height / 2,
    };
  }

  getImgDefaultSize(imgWidth, imgHeight) {
    let width = 0;
    let height = 0;
    let maxWidth = this.containerWidth;
    // let maxHeight = this.containerHeight;
    width = maxWidth;
    height = (width / imgWidth) * imgHeight;
    let left = ( this.containerWidth - width ) / 2;
    let top = (this.containerHeight - height) / 2;
    return {
      width: width,
      height: height,
      left: left,
      top: top,
    };
  }

  getDistance(startPoint: Point, endPoint: Point) {
    let xLen = Math.abs(endPoint.x - startPoint.x);
    let yLen = Math.abs(endPoint.y - startPoint.y);
    return Math.sqrt(xLen * xLen + yLen * yLen);
  }

  loadImg(activeIndex, firstLoad: boolean = false) {
    let imgSrc = '';
    let images = this.props.images || [];
    if (images.length > 0) {
      imgSrc = images[activeIndex].src;
    }
    let img = new Image();
    img.src = imgSrc;
    if (firstLoad) {
      this.setState({
        activeIndex: activeIndex,
        width: 0,
        height: 0,
        left: this.containerWidth / 2,
        top:  this.containerHeight / 2,
        scale: 1,
        swiperDistance: 0,
        touch: false,
      });
    }else {
      this.setState({
        activeIndex: activeIndex,
        swiperDistance: 0,
        touch: false,
      });
    }
    img.onload = () => {
      let imgWidth = img.width;
      let imgHeight = img.height;
      if (firstLoad) {
        setTimeout(() => {
          this.setState({
            imageWidth: imgWidth,
            imageHeight: imgHeight,
          });
          let imgCenterXY = this.getImageCenterXY();
          this.handleZoom(imgCenterXY.x, imgCenterXY.y, 1, 1);
        }, 0);
      }else {
        const imgDefaultSize = this.getImgDefaultSize(imgWidth, imgHeight);
        this.setState({
          activeIndex: activeIndex,
          width: imgDefaultSize.width,
          height: imgDefaultSize.height,
          left: imgDefaultSize.left,
          top: imgDefaultSize.top,
          imageWidth: imgWidth,
          imageHeight: imgHeight,
          scale: 1,
        });
      }
    };
    img.onerror = () => {
      this.setState({
        activeIndex: activeIndex,
        imageWidth: 0,
        imageHeight: 0,
      });
    };
  }

  handleZoom(targetX, targetY, scale, pinchScale) {
    let diffScale = scale - this.state.scale;
    let imgCenterXY = this.getImageCenterXY();
    let diffX = targetX - imgCenterXY.x;
    let diffY = targetY - imgCenterXY.y;
    let diffWidth = this.state.width * diffScale;
    let diffHeight = this.state.height * diffScale;
    // when image width is 0, set original width
    if (diffWidth === 0) {
      const imgDefaultSize = this.getImgDefaultSize(this.state.imageWidth, this.state.imageHeight);
      diffWidth = imgDefaultSize.width;
      diffHeight = imgDefaultSize.height;
    }
    this.setState({
      width: this.state.width + diffWidth,
      height: this.state.height + diffHeight,
      top: this.state.top - diffHeight / 2 - diffY * diffScale,
      left: this.state.left - diffWidth / 2 - diffX * diffScale,
      scale: scale,
      pinchScale,
    });
  }

  componentDidMount() {
    this.startVisible(this.props.activeIndex);
  }

  startVisible = (activeIndex) => {
    document.body.addEventListener('touchmove', this.handleBodyTouchmove, { passive: false });
    this.loadImg(activeIndex, true);
  }

  close = () => {
    document.body.removeEventListener('touchmove', this.handleBodyTouchmove);
    this.props.onClose();
  }

  componentWillReceiveProps(nextProps: ViewerProps) {
    if (!this.props.visible && nextProps.visible) {
      this.startVisible(nextProps.activeIndex);
      setTimeout(() => {
        this.setState({
          swiperDistance: 0,
        });
      }, 10);
      return;
    }
    if (this.state.activeIndex !== nextProps.activeIndex) {
      this.loadImg(nextProps.activeIndex);
      return;
    }
  }

  render() {
    let className = `${this.prefixCls}`;

    let viewerStryle: React.CSSProperties = {
      opacity: this.props.visible ? 1 : 0,
      width: window.innerWidth,
      height: window.innerHeight,
      position: 'absolute',
      top: 0,
    };

    if (!this.props.visible) {
      viewerStryle.display = 'none';
    }
    if (this.props.visible) {
      viewerStryle.display = 'block';
    }

    let zIndex = this.props.zIndex;

    let activeImg: ImageDecorator = {
      src: '',
      alt: '',
    };
    let images = this.props.images || [];
    if (this.props.visible) {
      if (images.length > 0 && this.state.activeIndex >= 0) {
        activeImg = images[this.state.activeIndex];
      }
    }

    let translateXs = [];
    let deviceWidth = this.containerWidth;
    for (let i = 0; i < this.state.activeIndex; i++) {
      let translateX = -deviceWidth * (this.state.activeIndex - i) + this.state.swiperDistance;
      translateXs.push(translateX);
    }
    for (let i = this.state.activeIndex; i < this.props.images.length; i++) {
      let translateX = deviceWidth * (i - this.state.activeIndex) + this.state.swiperDistance;
      translateXs.push(translateX);
    }

    return (
      <div
      className={className}
      style={viewerStryle}
      onTouchStart={this.handleTouchStart.bind(this)}
      onTouchMove={this.handleTouchMove.bind(this)}
      onTouchEnd={this.handleTouchEnd.bind(this)}
      >
        <div className={`${this.prefixCls}-mask`} style={{zIndex: zIndex}}></div>
        {this.props.images.map((image, index) => {
          if (index === this.state.activeIndex) {
            return (
              <ViewerCanvas
              key={index}
              prefixCls={this.prefixCls}
              imgSrc={image.src}
              visible={this.props.visible}
              width={this.state.width}
              height={this.state.height}
              top={this.state.top}
              left={this.state.left}
              zIndex={zIndex + 5}
              touch={this.state.touch}
              translateX={translateXs[index]}
              />
            );
          }else {
            if (Math.abs(this.state.activeIndex - index) > 1) {
              return null;
            }
            return (
              <ViewerCanvas
              key={index}
              prefixCls={this.prefixCls}
              imgSrc={image.src}
              visible={this.props.visible}
              width={DEFAULT_IMAGE_WIDTH}
              height={DEFAULT_IMAGE_HEIGHT}
              top={(this.containerHeight - DEFAULT_IMAGE_HEIGHT) / 2}
              left={(this.containerWidth - DEFAULT_IMAGE_WIDTH) / 2}
              zIndex={zIndex + 5}
              touch={this.state.touch}
              translateX={translateXs[index]}
              />
            );
          }

        })}
        <div style={{position: 'absolute',top: 0, left: 0, zIndex: zIndex + 10}}>{this.text1}</div>
        <div style={{position: 'absolute',top: 20, left: 0, zIndex: zIndex + 10}}>{this.text2}</div>
      </div>
    );
  }
}
